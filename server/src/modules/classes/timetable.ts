import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../../lib/audit.js';
import type { AuthUser } from '../../lib/auth.js';
import { classAccess } from '../../lib/auth.js';
import { addDays } from '../../lib/dates.js';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { registry, route } from '../../lib/openapi.js';
import { daySchedule } from './schedule.math.js';
import { activeTerm, writable } from './service.js';

// CS-04: the weekly timetable (the base of D10). Overlaps are allowed (D11) and reported in `clashWith`. Mounted at /classes/:id.

export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');
const idParams = z.object({ id: z.string().min(1) });
const slotParams = idParams.extend({ slotId: z.string().min(1) });
const room = z.string().trim().max(40);
const slotFields = z.object({ subjectId: z.string().min(1), weekday: z.number().int().min(1).max(6), start: hhmm, end: hhmm, room: room.optional() });
const slotBody = slotFields.refine((s) => s.start < s.end, { message: 'start must be before end', path: ['end'] });
type SlotBody = z.infer<typeof slotFields>;

const person = z.object({ id: z.string(), name: z.string() });
const slot = z
  .object({
    id: z.string(),
    termId: z.string(),
    weekday: z.number().int(),
    start: z.string(),
    end: z.string(),
    room: z.string().nullable(),
    subject: z.object({ id: z.string(), name: z.string() }),
    teacher: person.nullable(),
    /** Ids of this class's slots it overlaps on the same weekday. */
    clashWith: z.array(z.string()),
  })
  .meta({ id: 'TimetableSlot' });
const week = z.object({ termId: z.string().nullable(), days: z.array(z.object({ weekday: z.number().int(), slots: z.array(slot) })) }).meta({ id: 'TimetableWeek' });

const include = { subject: { select: { id: true, name: true, teacher: { select: { id: true, name: true } } } } } satisfies Prisma.TimetableSlotInclude;
type Row = Prisma.TimetableSlotGetPayload<{ include: typeof include }>;

const MONDAY = new Date('2024-01-01'); // any Monday: weekday n = MONDAY + n-1 days, so daySchedule can mark a week's clashes

/** A term's week, grouped Mon..Sat, each slot with its same-day clashes. */
const toWeek = (termId: string | null, rows: Row[]) => {
  const slots = rows.map((r) => ({ ...r, teacherId: r.subject.teacher?.id ?? null }));
  return {
    termId,
    days: [1, 2, 3, 4, 5, 6].map((weekday) => {
      const clash = new Map(daySchedule(slots, [], addDays(MONDAY, weekday - 1)).map((i) => [i.id, i.clashWith]));
      return {
        weekday,
        slots: rows
          .filter((r) => r.weekday === weekday)
          .sort((a, b) => a.start.localeCompare(b.start))
          .map((r) => ({ id: r.id, termId: r.termId, weekday, start: r.start, end: r.end, room: r.room, subject: { id: r.subject.id, name: r.subject.name }, teacher: r.subject.teacher, clashWith: clash.get(r.id) ?? [] })),
      };
    }),
  };
};

const termSlots = (tx: Prisma.TransactionClient, termId: string) => tx.timetableSlot.findMany({ where: { termId }, include });
const oneSlot = async (tx: Prisma.TransactionClient, termId: string, slotId: string) =>
  toWeek(termId, await termSlots(tx, termId)).days.flatMap((d) => d.slots).find((s) => s.id === slotId)!;

/** Every subject must be in this term → 422. */
const assertSubjects = async (tx: Prisma.TransactionClient, termId: string, ids: string[]) => {
  const wanted = [...new Set(ids)];
  if ((await tx.subject.count({ where: { termId, id: { in: wanted } } })) !== wanted.length)
    throw new HttpError(422, 'VALIDATION', "Every subject must be one of this term's subjects");
};

/** A slot of this class's active term, or 404. */
const findSlot = async (tx: Prisma.TransactionClient, classId: string, slotId: string) => {
  const term = await activeTerm(classId, tx);
  const s = await tx.timetableSlot.findFirst({ where: { id: slotId, classId, termId: term.id } });
  if (!s) throw new HttpError(404, 'NOT_FOUND', 'Slot not found');
  return s;
};

const line = (s: { weekday: number; start: string; end: string; subjectId: string; room?: string | null }) => `${s.weekday} ${s.start}-${s.end} ${s.subjectId}${s.room ? ` ${s.room}` : ''}`;
const snapshot = (s: SlotBody | { subjectId: string; weekday: number; start: string; end: string; room: string | null }) => ({ subjectId: s.subjectId, weekday: s.weekday, start: s.start, end: s.end, room: s.room ?? null });

/** Replace the active term's whole week + audit (PUT /timetable; reused by CS-06 apply, which has just created its subjects in `tx`). */
export const replaceWeek = async (tx: Prisma.TransactionClient, user: AuthUser, classId: string, slots: SlotBody[]) => {
  const term = await activeTerm(classId, tx);
  await assertSubjects(tx, term.id, slots.map((s) => s.subjectId));
  const before = await tx.timetableSlot.findMany({ where: { termId: term.id }, orderBy: [{ weekday: 'asc' }, { start: 'asc' }] });
  // ponytail: replacing drops the old slot ids, so their per-date changes go too (cascade); match slots if that bites.
  await tx.timetableSlot.deleteMany({ where: { termId: term.id } });
  await tx.timetableSlot.createMany({ data: slots.map((s) => ({ ...snapshot(s), classId, termId: term.id })) });
  await audit(
    user,
    { action: 'timetable.replace', classId, targetType: 'Term', targetId: term.id, before: { count: before.length, slots: before.map(line) }, after: { count: slots.length, slots: slots.map(line) } },
    tx,
  );
  return toWeek(term.id, await termSlots(tx, term.id));
};

const router = Router({ mergeParams: true });

router.get(
  '/timetable',
  classAccess('id', 'read'),
  route(registry, {
    method: 'get',
    path: '/classes/:id/timetable',
    summary: "A term's weekly slots, grouped Mon (1) to Sat (6) (default: the latest term)",
    guard: 'classAccess',
    request: { params: idParams, query: z.object({ termId: z.string().min(1).optional() }) },
    responses: { 200: week },
  }),
  async (req, res) => {
    const classId = String(req.params.id);
    const q = (req.query as { termId?: string }).termId;
    const termId = (await db.term.findFirst({ where: { classId, ...(q && { id: q }) }, orderBy: { semester: 'desc' } }))?.id ?? null;
    res.json(toWeek(termId, termId ? await termSlots(db, termId) : []));
  },
);

router.post(
  '/timetable',
  classAccess('id', 'board'),
  writable,
  route(registry, {
    method: 'post',
    path: '/classes/:id/timetable',
    summary: 'Add a weekly slot to the active term; overlaps are allowed and returned in clashWith',
    guard: 'classAccess',
    request: { params: idParams, body: slotBody },
    responses: { 201: slot, 409: null },
  }),
  async (req, res) => {
    const classId = String(req.params.id);
    const body = req.body as SlotBody;
    const created = await db.$transaction(async (tx) => {
      const term = await activeTerm(classId, tx);
      await assertSubjects(tx, term.id, [body.subjectId]);
      const s = await tx.timetableSlot.create({ data: { ...snapshot(body), classId, termId: term.id } });
      await audit(req.user!, { action: 'timetable.create', classId, targetType: 'TimetableSlot', targetId: s.id, after: snapshot(s) }, tx);
      return oneSlot(tx, term.id, s.id);
    });
    res.status(201).json(created);
  },
);

router.patch(
  '/timetable/:slotId',
  classAccess('id', 'board'),
  writable,
  route(registry, {
    method: 'patch',
    path: '/classes/:id/timetable/:slotId',
    summary: 'Edit a slot of the active term (room null clears it)',
    guard: 'classAccess',
    request: { params: slotParams, body: slotFields.partial().extend({ room: room.nullable().optional() }) },
    responses: { 200: slot, 404: null, 409: null },
  }),
  async (req, res) => {
    const { id: classId, slotId } = req.params as { id: string; slotId: string };
    const body = req.body as Partial<SlotBody> & { room?: string | null };
    const updated = await db.$transaction(async (tx) => {
      const before = await findSlot(tx, classId, slotId);
      if ((body.start ?? before.start) >= (body.end ?? before.end)) throw new HttpError(422, 'VALIDATION', 'start must be before end');
      if (body.subjectId) await assertSubjects(tx, before.termId, [body.subjectId]);
      const after = await tx.timetableSlot.update({ where: { id: slotId }, data: { ...body, room: body.room === undefined ? undefined : body.room || null } });
      await audit(req.user!, { action: 'timetable.update', classId, targetType: 'TimetableSlot', targetId: slotId, before: snapshot(before), after: snapshot(after) }, tx);
      return oneSlot(tx, before.termId, slotId);
    });
    res.json(updated);
  },
);

router.delete(
  '/timetable/:slotId',
  classAccess('id', 'board'),
  writable,
  route(registry, {
    method: 'delete',
    path: '/classes/:id/timetable/:slotId',
    summary: "Delete a slot of the active term (its per-date changes go with it; attendance keeps its history)",
    guard: 'classAccess',
    request: { params: slotParams },
    responses: { 204: null, 404: null, 409: null },
  }),
  async (req, res) => {
    const { id: classId, slotId } = req.params as { id: string; slotId: string };
    await db.$transaction(async (tx) => {
      const s = await findSlot(tx, classId, slotId);
      await tx.timetableSlot.delete({ where: { id: slotId } });
      await audit(req.user!, { action: 'timetable.delete', classId, targetType: 'TimetableSlot', targetId: slotId, before: snapshot(s) }, tx);
    });
    res.status(204).end();
  },
);

router.put(
  '/timetable',
  classAccess('id', 'board'),
  writable,
  route(registry, {
    method: 'put',
    path: '/classes/:id/timetable',
    summary: "Replace the active term's whole week in one transaction (import apply, \"edit week\" save)",
    guard: 'classAccess',
    request: { params: idParams, body: z.object({ slots: z.array(slotBody).max(200) }) },
    responses: { 200: week, 409: null },
  }),
  async (req, res) => {
    const classId = String(req.params.id);
    const { slots } = req.body as { slots: SlotBody[] };
    const result = await db.$transaction((tx) => replaceWeek(tx, req.user!, classId, slots));
    res.json(result);
  },
);

export default router;
