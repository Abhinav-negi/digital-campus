import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../../../lib/audit.js';
import type { AuthUser } from '../../../lib/auth.js';
import { classAccess } from '../../../lib/auth.js';
import { db } from '../../../lib/db.js';
import { HttpError } from '../../../lib/http.js';
import { registry, route } from '../../../lib/openapi.js';
import { create } from '../board.js';
import { activeTerm, writable } from '../service.js';
import { allot } from '../subjects.js';
import { replaceWeek } from '../timetable.js';
import { bestMatch, normDate, normTime, normWeekday } from './match.js';
import prompts from './prompts.js';
import { applyBody, draft, input, kinds, previewBody, summary, type Issue, type Kind } from './schemas.js';

// CS-06: import via any chatbot (D8). Stateless: preview validates + matches, apply writes in one transaction. Mounted at /classes/:id.

const idParams = z.object({ id: z.string().min(1) });
const key = (s: string) => s.trim().toLowerCase();
const bad = (msg: string) => new HttpError(422, 'VALIDATION', msg);

/** A pasted chatbot reply (maybe in a ```json fence, maybe with chatter around it) or an already-parsed object. */
const parseJson = (data: unknown) => {
  if (typeof data !== 'string') return data;
  const text = data.trim();
  const body = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)?.[1] ?? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  try {
    return JSON.parse(body);
  } catch (e) {
    throw bad(`That is not valid JSON (${(e as Error).message}). Paste the chatbot's reply as it is.`);
  }
};

const parseInput = <K extends Kind>(kind: K, data: unknown): z.infer<(typeof input)[K]> => {
  const r = input[kind].safeParse(parseJson(data));
  if (!r.success) throw bad(z.prettifyError(r.error));
  return r.data as z.infer<(typeof input)[K]>;
};

const count = (rows: { issue?: Issue }[]) => {
  const out: Record<string, number> = {};
  for (const r of rows) if (r.issue) out[r.issue] = (out[r.issue] ?? 0) + 1;
  return out;
};

// --- timetable ---
type TT = z.infer<typeof draft.timetable>;
type TTLoose = { subjects: TT['subjects']; slots: { subject: string; weekday: string | number; start: string | number; end: string | number; room?: string | null }[] };

/** Normalise times/weekdays and flag rows; used by preview and again by apply (the CR may have edited the draft). */
const cleanTimetable = (d: TTLoose): TT => {
  const names = new Set(d.subjects.map((s) => key(s.name)));
  return {
    subjects: d.subjects.map((s) => ({ ...s, ...(!s.teacherId && s.teacherName ? { issue: 'unmatched-teacher' as const } : { issue: undefined }) })),
    slots: d.slots.map((s) => {
      const [weekday, start, end] = [normWeekday(s.weekday), normTime(s.start), normTime(s.end)];
      const issue: Issue | undefined = weekday === null || !start || !end || start >= end ? 'bad-time' : names.has(key(s.subject)) ? undefined : 'unknown-subject';
      return { subject: s.subject, weekday: weekday ?? 0, start: start ?? String(s.start), end: end ?? String(s.end), room: s.room || null, issue };
    }),
  };
};

const applyTimetable = async (user: AuthUser, classId: string, d: TT) => {
  const c = cleanTimetable(d);
  if (c.slots.some((s) => s.issue)) throw bad('Fix the highlighted timetable rows (time, weekday or subject) before applying');
  const subjects = [...new Map(c.subjects.map((s) => [key(s.name), s])).values()];
  const teacherIds = [...new Set(subjects.flatMap((s) => (s.teacherId ? [s.teacherId] : [])))];
  await db.$transaction(async (tx) => {
    const term = await activeTerm(classId, tx);
    if (teacherIds.length && (await tx.user.count({ where: { id: { in: teacherIds }, role: 'staff', status: 'active' } })) !== teacherIds.length)
      throw bad('Every teacher must be an active staff member');
    const existing = await tx.subject.findMany({ where: { termId: term.id } });
    const ids = new Map<string, string>();
    for (const s of subjects) {
      const old = existing.find((e) => key(e.name) === key(s.name));
      if (old) {
        await tx.subject.update({ where: { id: old.id }, data: { code: s.code || undefined, ...(s.teacherId && { teacherId: s.teacherId, assignedById: user.id }) } });
        await allot(tx, old.id, old.teacherId, s.teacherId ?? old.teacherId, user);
        ids.set(key(s.name), old.id);
      } else {
        const made = await tx.subject.create({ data: { classId, termId: term.id, name: s.name, code: s.code || null, teacherId: s.teacherId, assignedById: user.id } });
        await allot(tx, made.id, null, s.teacherId, user);
        await audit(user, { action: 'subject.create', classId, targetType: 'Subject', targetId: made.id, after: { name: made.name, code: made.code, teacherId: s.teacherId, via: 'import' } }, tx);
        ids.set(key(s.name), made.id);
      }
    }
    await replaceWeek(tx, user, classId, c.slots.map((s) => ({ subjectId: ids.get(key(s.subject))!, weekday: s.weekday, start: s.start, end: s.end, room: s.room || undefined })));
    await audit(user, { action: 'import.timetable', classId, targetType: 'Term', targetId: term.id, after: { subjects: subjects.length, slots: c.slots.length } }, tx);
  });
  return { subjects: subjects.length, slots: c.slots.length };
};

// --- syllabus + datesheet ---
type SY = z.infer<typeof draft.syllabus>;
type DS = z.infer<typeof draft.datesheet>;

const cleanSyllabus = (d: SY): SY => ({ subjects: d.subjects.map((s) => ({ ...s, issue: s.subjectId ? undefined : 'unknown-subject' })) });
const cleanDatesheet = (d: DS): DS => ({
  exams: d.exams.map((e) => {
    const date = normDate(e.date);
    return { ...e, date: date ?? e.date, issue: !date ? 'bad-date' : e.subjectId ? undefined : 'unknown-subject' };
  }),
});

const board = async (user: AuthUser, classId: string, action: string, items: Parameters<typeof create>[3][]) => {
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const item of items) await create(tx, user, classId, item, { via: 'import' });
    await audit(user, { action, classId, targetType: 'Class', targetId: classId, after: { items: items.length } }, tx);
  });
  return { items: items.length };
};

const router = Router({ mergeParams: true });

router.get(
  '/imports/prompts',
  classAccess('id', 'board'),
  route(registry, {
    method: 'get',
    path: '/classes/:id/imports/prompts',
    summary: 'The ready-made prompt per kind: copy it into any chatbot together with the PDF or photo',
    guard: 'classAccess',
    request: { params: idParams },
    responses: { 200: z.object({ timetable: z.string(), syllabus: z.string(), datesheet: z.string() }) },
  }),
  (_req, res) => {
    res.json(prompts);
  },
);

router.post(
  '/imports/preview',
  classAccess('id', 'board'),
  writable,
  route(registry, {
    method: 'post',
    path: '/classes/:id/imports/preview',
    summary: "Validate a chatbot's JSON (raw text or object) and return an editable draft; nothing is stored",
    guard: 'classAccess',
    request: { params: idParams, body: previewBody },
    responses: {
      200: z.object({ draft: z.union([draft.timetable, draft.syllabus, draft.datesheet]), summary }),
      409: null,
    },
  }),
  async (req, res) => {
    const classId = String(req.params.id);
    const { kind, data } = req.body as z.infer<typeof previewBody>;
    if (kind === 'timetable') {
      const d = parseInput('timetable', data);
      const staff = await db.user.findMany({ where: { role: 'staff', status: 'active' }, select: { id: true, name: true } });
      const out = cleanTimetable({
        slots: d.slots,
        subjects: d.subjects.map((s) => ({ ...s, teacherId: (s.teacherName && bestMatch(s.teacherName, staff)?.id) || null })),
      });
      return void res.json({ draft: out, summary: { counts: { subjects: out.subjects.length, slots: out.slots.length }, issues: count([...out.subjects, ...out.slots]) } });
    }
    const subjects = await db.subject.findMany({ where: { classId, termId: (await activeTerm(classId)).id }, select: { id: true, name: true } });
    const find = (name: string) => bestMatch(name, subjects)?.id ?? null;
    if (kind === 'syllabus') {
      const out = cleanSyllabus({ subjects: parseInput('syllabus', data).subjects.map((s) => ({ ...s, subjectId: find(s.name) })) });
      return void res.json({ draft: out, summary: { counts: { subjects: out.subjects.length }, issues: count(out.subjects) } });
    }
    const out = cleanDatesheet({ exams: parseInput('datesheet', data).exams.map((e) => ({ ...e, date: String(e.date), subjectId: find(e.subject) })) });
    res.json({ draft: out, summary: { counts: { exams: out.exams.length }, issues: count(out.exams) } });
  },
);

router.post(
  '/imports/apply',
  classAccess('id', 'board'),
  writable,
  route(registry, {
    method: 'post',
    path: '/classes/:id/imports/apply',
    summary: 'Write a (possibly edited) draft in one transaction: timetable = subjects + teacher allotments + the week; syllabus/datesheet = board items',
    guard: 'classAccess',
    request: { params: idParams, body: applyBody },
    responses: { 200: z.object({ kind: z.enum(kinds), counts: z.record(z.string(), z.number()) }), 409: null },
  }),
  async (req, res) => {
    const classId = String(req.params.id);
    const user = req.user!;
    const body = req.body as z.infer<typeof applyBody>;
    if (body.kind === 'timetable') return void res.json({ kind: body.kind, counts: await applyTimetable(user, classId, body.draft) });
    if (body.kind === 'syllabus') {
      const rows = cleanSyllabus(body.draft).subjects;
      if (rows.some((r) => r.issue)) throw bad('Pick a subject for every highlighted syllabus row');
      const items = rows.map((r) => ({ kind: 'syllabus' as const, title: `${r.name} syllabus`, body: null, subjectId: r.subjectId, date: null, pinned: false, units: r.units, fileKey: null, fileName: null }));
      return void res.json({ kind: body.kind, counts: await board(user, classId, 'import.syllabus', items) });
    }
    const rows = cleanDatesheet(body.draft).exams;
    if (rows.some((r) => r.issue === 'bad-date')) throw bad('Fix the highlighted exam dates before applying');
    // An exam whose subject did not match is still a valid board item (no subject).
    const items = rows.map((r) => ({ kind: 'exam' as const, title: r.title, body: r.note || null, subjectId: r.subjectId, date: new Date(r.date), pinned: false, units: [], fileKey: null, fileName: null }));
    res.json({ kind: body.kind, counts: await board(user, classId, 'import.datesheet', items) });
  },
);

export default router;
