import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../../lib/audit.js';
import type { AuthUser } from '../../lib/auth.js';
import { classAccess } from '../../lib/auth.js';
import { addDays, dow, today } from '../../lib/dates.js';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { notify } from '../../lib/notify.js';
import { registry, route } from '../../lib/openapi.js';
import { type Item, daySchedule, teacherClashes } from './schedule.math.js';
import { activeTerm, classAudience, writable } from './service.js';
import { hhmm } from './timetable.js';

// CS-05: per-date changes (D10) and the computed schedule with clashes (D11, ARCH §9.3). Mounted at /classes/:id.

const idParams = z.object({ id: z.string().min(1) });
const MAX_DAYS = 14;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const person = z.object({ id: z.string(), name: z.string() });

const scheduleItem = z
  .object({
    /** Slot id, or the change id for an extra, an event or a moved class. */
    id: z.string(),
    kind: z.enum(['class', 'extra', 'event']),
    classId: z.string(),
    slotId: z.string().nullable(),
    subject: z.object({ id: z.string(), name: z.string() }).nullable(),
    teacher: person.nullable(),
    title: z.string().nullable(),
    start: z.string(),
    end: z.string(),
    room: z.string().nullable(),
    /** Shown but not happening: cancelled, or moved to another date. */
    off: z.boolean(),
    change: z
      .object({
        id: z.string(),
        kind: z.enum(['cancelled', 'moved', 'extra', 'event']),
        date: z.string(),
        movedToDate: z.string().nullable(),
        start: z.string().nullable(),
        end: z.string().nullable(),
        note: z.string().nullable(),
        author: person,
      })
      .nullable(),
    /** What it overlaps: in this class, or the same teacher in another class. */
    clashWith: z.array(z.object({ id: z.string(), classId: z.string(), className: z.string(), name: z.string(), start: z.string(), end: z.string() })),
  })
  .meta({ id: 'ScheduleItem' });

const subjectSel = { select: { id: true, name: true, teacher: { select: { id: true, name: true } } } } as const;
const changeInclude = { subject: subjectSel, author: { select: { id: true, name: true } } } satisfies Prisma.ScheduleChangeInclude;
type ChangeRow = Prisma.ScheduleChangeGetPayload<{ include: typeof changeInclude }> & { teacherId: string | null };
type SlotRow = Prisma.TimetableSlotGetPayload<{ include: { subject: typeof subjectSel } }> & { teacherId: string | null };
type Loaded = Item<ChangeRow>;

/**
 * Every day in from..to for this class and for every class its teachers also teach in (so a teacher in two places
 * clashes, D11). Active terms only. `items` per day span all those classes; filter by classId to show one.
 */
const load = async (tx: Prisma.TransactionClient, classId: string, from: Date, to: Date) => {
  const active = { term: { endedAt: null } };
  const mine = await tx.subject.findMany({ where: { classId, ...active, teacherId: { not: null } }, select: { teacherId: true } });
  const others = await tx.subject.findMany({ where: { ...active, teacherId: { in: mine.map((s) => s.teacherId!) } }, select: { classId: true }, distinct: ['classId'] });
  const classIds = [...new Set([classId, ...others.map((s) => s.classId)])];
  const [slotRows, changeRows, classes] = await Promise.all([
    tx.timetableSlot.findMany({ where: { classId: { in: classIds }, ...active }, include: { subject: subjectSel } }),
    tx.scheduleChange.findMany({
      where: { classId: { in: classIds }, ...active, OR: [{ date: { gte: from, lte: to } }, { movedToDate: { gte: from, lte: to } }] },
      include: changeInclude,
      orderBy: { createdAt: 'asc' },
    }),
    tx.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } }),
  ]);
  const slots: SlotRow[] = slotRows.map((s) => ({ ...s, teacherId: s.subject.teacher?.id ?? null }));
  const changes: ChangeRow[] = changeRows.map((c) => ({ ...c, teacherId: c.subject?.teacher?.id ?? null }));
  const days: { date: Date; items: Loaded[] }[] = [];
  for (let date = from; date <= to; date = addDays(date, 1))
    days.push({ date, items: teacherClashes(classIds.flatMap((id) => daySchedule(slots.filter((s) => s.classId === id), changes.filter((c) => c.classId === id), date))) });
  return { days, slots: new Map(slots.map((s) => [s.id, s])), classNames: new Map(classes.map((c) => [c.id, c.name])) };
};
type World = Awaited<ReturnType<typeof load>>;

const nameOf = (w: World, i: Loaded) => (i.slotId ? w.slots.get(i.slotId)?.subject.name : i.change?.subject?.name) ?? i.title ?? '';

const present = (w: World, items: Loaded[], i: Loaded) => {
  const subject = i.slotId ? w.slots.get(i.slotId)!.subject : (i.change?.subject ?? null);
  const c = i.change;
  return {
    id: i.id,
    kind: i.kind,
    classId: i.classId,
    slotId: i.slotId,
    subject: subject && { id: subject.id, name: subject.name },
    teacher: subject?.teacher ?? null,
    title: i.title,
    start: i.start,
    end: i.end,
    room: i.room,
    off: i.off,
    change: c && { id: c.id, kind: c.kind, date: iso(c.date), movedToDate: c.movedToDate && iso(c.movedToDate), start: c.start, end: c.end, note: c.note, author: c.author },
    clashWith: i.clashWith.map((id) => {
      const b = items.find((x) => x.id === id)!;
      return { id, classId: b.classId, className: w.classNames.get(b.classId) ?? '', name: nameOf(w, b), start: b.start, end: b.end };
    }),
  };
};

/** ARCH §3: board (CR, class teacher) and admin change anything; a subject teacher only their own subject's classes. */
const assertMay = async (tx: Prisma.TransactionClient, user: AuthUser, classId: string, subjectId: string | null) => {
  if (user.isAdmin) return;
  const cls = await tx.class.findUniqueOrThrow({ where: { id: classId }, select: { classTeacherId: true, members: { where: { userId: user.id, role: 'cr' }, select: { userId: true } } } });
  if (cls.classTeacherId === user.id || cls.members.length > 0) return;
  if (subjectId && (await tx.subject.count({ where: { id: subjectId, classId, teacherId: user.id } }))) return;
  throw new HttpError(403, 'FORBIDDEN', "Only the CR, the class teacher or the subject's own teacher can change this");
};

/** Clash pairs touching this class on `dates`, keyed by the two item ids. */
const clashPairs = async (tx: Prisma.TransactionClient, classId: string, dates: Date[]) => {
  const out = new Map<string, { date: Date; w: World; a: Loaded; b: Loaded }>();
  for (const date of dates) {
    const w = await load(tx, classId, date, date);
    const items = w.days[0]!.items;
    for (const a of items.filter((i) => i.classId === classId))
      for (const id of a.clashWith) {
        const b = items.find((i) => i.id === id)!;
        out.set([a.id, b.id].sort().join('|'), { date, w, a, b });
      }
  }
  return out;
};

/** How to cancel or postpone an item, for the clash notification's buttons. */
const actions = (i: Loaded, date: Date) => {
  const changes = `/classes/${i.classId}/changes`;
  if (!i.slotId) return { cancel: { method: 'DELETE', path: `${changes}/${i.id}` }, postpone: null };
  const on = iso(i.change?.date ?? date); // a moved class is re-cancelled/re-moved on its original date
  return { cancel: { method: 'POST', path: changes, body: { date: on, kind: 'cancelled', slotId: i.slotId } }, postpone: { method: 'POST', path: changes, body: { date: on, kind: 'moved', slotId: i.slotId } } };
};

/** D11: tell every teacher in a clash this write created ("who's taking it?"). */
const notifyNewClashes = async (tx: Prisma.TransactionClient, before: Awaited<ReturnType<typeof clashPairs>>, after: Awaited<ReturnType<typeof clashPairs>>) => {
  for (const [key, { date, w, a, b }] of after) {
    if (before.has(key)) continue;
    const ref = (i: Loaded) => ({ id: i.id, classId: i.classId, className: w.classNames.get(i.classId) ?? '', name: nameOf(w, i), start: i.start, end: i.end, ...actions(i, date) });
    const where = a.classId === b.classId ? `in ${w.classNames.get(a.classId)}` : `(${w.classNames.get(a.classId)} and ${w.classNames.get(b.classId)})`;
    const at = a.start > b.start ? a.start : b.start;
    await notify(
      [a.teacherId, b.teacherId].filter((t): t is string => !!t),
      'clash',
      { text: `Two classes overlap at ${at} on ${iso(date)} ${where}, who's taking it?`, date: iso(date), items: [ref(a), ref(b)] },
      tx,
    );
  }
};

const router = Router({ mergeParams: true });

router.get(
  '/schedule',
  classAccess('id', 'read'),
  route(registry, {
    method: 'get',
    path: '/classes/:id/schedule',
    summary: `The effective schedule per date (weekly slots + per-date changes, with clashes); from defaults to today, to to from, ≤${MAX_DAYS} days`,
    guard: 'classAccess',
    request: { params: idParams, query: z.object({ from: z.iso.date().optional(), to: z.iso.date().optional() }) },
    responses: { 200: z.object({ days: z.array(z.object({ date: z.string(), items: z.array(scheduleItem) })) }) },
  }),
  async (req, res) => {
    const classId = String(req.params.id);
    const q = req.query as { from?: string; to?: string };
    const from = q.from ? new Date(q.from) : today();
    const to = q.to ? new Date(q.to) : from;
    if (to < from || to > addDays(from, MAX_DAYS - 1)) throw new HttpError(422, 'VALIDATION', `to must be from..from + ${MAX_DAYS - 1} days`);
    const w = await load(db, classId, from, to);
    // Cross-class clashes (the same teacher elsewhere) are for staff; students only see their own class's items.
    const staff = req.user!.role === 'staff' || req.user!.isAdmin;
    const view = (item: ReturnType<typeof present>) => (staff ? item : { ...item, clashWith: item.clashWith.filter((c) => c.classId === classId) });
    res.json({ days: w.days.map((d) => ({ date: iso(d.date), items: d.items.filter((i) => i.classId === classId).map((i) => view(present(w, d.items, i))) })) });
  },
);

const changeBody = z.object({
  date: z.iso.date(),
  kind: z.enum(['cancelled', 'moved', 'extra', 'event']),
  slotId: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(120).optional(),
  start: hhmm.optional(),
  end: hhmm.optional(),
  room: z.string().trim().max(40).optional(),
  movedToDate: z.iso.date().optional(),
  note: z.string().trim().max(500).optional(),
});
type ChangeBody = z.infer<typeof changeBody>;
const bad = (message: string) => new HttpError(422, 'VALIDATION', message);
const SAY = { cancelled: 'is cancelled', moved: 'is moved', extra: 'extra class added', event: 'added' } as const;
const AUDIT = { cancelled: 'cancel', moved: 'move', extra: 'extra', event: 'event' } as const;

router.post(
  '/changes',
  classAccess('id', 'read'),
  writable,
  route(registry, {
    method: 'post',
    path: '/classes/:id/changes',
    summary:
      'Cancel or move a slot on a date (replaces its earlier cancel/move), or add an extra class or an event. CR, class teacher, admin; a subject teacher for their own subject only',
    guard: 'classAccess',
    request: { params: idParams, body: changeBody },
    responses: { 201: scheduleItem.shape.change.unwrap(), 403: null, 409: null },
  }),
  async (req, res) => {
    const classId = String(req.params.id);
    const me = req.user!;
    const b = req.body as ChangeBody;
    const date = new Date(b.date);
    const movedToDate = b.kind === 'moved' && b.movedToDate ? new Date(b.movedToDate) : null;
    const timed = b.kind !== 'cancelled';
    if (timed && !(b.start && b.end)) throw bad('start and end are required');
    if (timed && b.start! >= b.end!) throw bad('start must be before end');
    if (b.kind === 'extra' && !b.subjectId) throw bad('An extra class needs a subjectId');
    if (b.kind === 'event' && !b.title) throw bad('An event needs a title');

    const created = await db.$transaction(async (tx) => {
      const term = await activeTerm(classId, tx);
      let subjectId = b.subjectId ?? null;
      let slotId: string | null = null;
      if (b.kind === 'cancelled' || b.kind === 'moved') {
        const s = b.slotId ? await tx.timetableSlot.findFirst({ where: { id: b.slotId, termId: term.id } }) : null;
        if (!s || s.weekday !== dow(date)) throw bad('slotId must be a slot of this class on that date');
        [slotId, subjectId] = [s.id, s.subjectId];
      } else if (subjectId && !(await tx.subject.count({ where: { id: subjectId, termId: term.id } }))) throw bad("subjectId must be one of this term's subjects");
      await assertMay(tx, me, classId, subjectId);

      const dates = [date, ...(movedToDate ? [movedToDate] : [])];
      const before = await clashPairs(tx, classId, dates);
      if (slotId) await tx.scheduleChange.deleteMany({ where: { classId, slotId, date, kind: { in: ['cancelled', 'moved'] } } });
      const c = await tx.scheduleChange.create({
        data: {
          classId,
          termId: term.id,
          date,
          kind: b.kind,
          slotId,
          subjectId,
          title: b.kind === 'event' || b.kind === 'extra' ? (b.title ?? null) : null,
          start: timed ? b.start! : null,
          end: timed ? b.end! : null,
          room: timed ? b.room || null : null,
          movedToDate,
          note: b.note || null,
          authorId: me.id,
        },
        include: changeInclude,
      });
      const name = c.subject?.name ?? c.title ?? '';
      const when = b.kind === 'cancelled' ? iso(date) : `${iso(movedToDate ?? date)} ${c.start}–${c.end}`;
      await audit(me, { action: `schedule.${AUDIT[b.kind]}`, classId, targetType: 'ScheduleChange', targetId: c.id, after: { subject: name, date: iso(date), kind: c.kind, start: c.start, end: c.end, movedToDate: movedToDate && iso(movedToDate) } }, tx);
      await notify((await classAudience(classId, tx)).filter((u) => u !== me.id), 'class-change', { text: `${name} ${SAY[b.kind]}: ${when}`, classId, changeId: c.id, date: iso(date) }, tx);
      await notifyNewClashes(tx, before, await clashPairs(tx, classId, dates));
      return c;
    });
    res.status(201).json({ id: created.id, kind: created.kind, date: iso(created.date), movedToDate: created.movedToDate && iso(created.movedToDate), start: created.start, end: created.end, note: created.note, author: created.author });
  },
);

router.delete(
  '/changes/:changeId',
  classAccess('id', 'read'),
  writable,
  route(registry, {
    method: 'delete',
    path: '/classes/:id/changes/:changeId',
    summary: 'Undo a per-date change (same rule as making it)',
    guard: 'classAccess',
    request: { params: idParams.extend({ changeId: z.string().min(1) }) },
    responses: { 204: null, 403: null, 404: null, 409: null },
  }),
  async (req, res) => {
    const { id: classId, changeId } = req.params as { id: string; changeId: string };
    const me = req.user!;
    await db.$transaction(async (tx) => {
      const c = await tx.scheduleChange.findFirst({ where: { id: changeId, classId, term: { endedAt: null } }, include: changeInclude });
      if (!c) throw new HttpError(404, 'NOT_FOUND', 'Change not found');
      await assertMay(tx, me, classId, c.subjectId);
      const dates = [c.date, ...(c.movedToDate ? [c.movedToDate] : [])];
      const before = await clashPairs(tx, classId, dates);
      await tx.scheduleChange.delete({ where: { id: changeId } });
      const name = c.subject?.name ?? c.title ?? '';
      await audit(me, { action: 'schedule.undo', classId, targetType: 'ScheduleChange', targetId: changeId, before: { subject: name, date: iso(c.date), kind: c.kind, start: c.start, end: c.end } }, tx);
      await notify((await classAudience(classId, tx)).filter((u) => u !== me.id), 'class-change', { text: `${name} on ${iso(c.date)}: the change was undone`, classId, changeId, date: iso(c.date) }, tx);
      await notifyNewClashes(tx, before, await clashPairs(tx, classId, dates));
    });
    res.status(204).end();
  },
);

export default router;
