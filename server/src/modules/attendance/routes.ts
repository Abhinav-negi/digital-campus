import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../../lib/audit.js';
import { auth, classAccess, staff, type AuthUser } from '../../lib/auth.js';
import { addDays, today } from '../../lib/dates.js';
import { db } from '../../lib/db.js';
import { HttpError, notFound } from '../../lib/http.js';
import { notify } from '../../lib/notify.js';
import { registry, route } from '../../lib/openapi.js';
import { codeAt, codeMatches, isOpen, newSecret, refundGuess, secondsLeft, stepAt, takeGuess, WINDOW_MS } from './code.js';
import { attendanceSummary } from './math.js';

// CS-09 roll + views, CS-10 check-in code (ARCH §3, §9.5, SPEC §8).
// app.ts mounts this at /attendance-sessions, /checkin, /me/attendance (and /classes/:id/attendance); the mount picks a sub-router.

const idParams = z.object({ id: z.string().min(1) });
const ref = z.object({ id: z.string(), name: z.string() });
const status = z.enum(['safe', 'warn', 'danger']);
const rosterEntry = z.object({ id: z.string(), name: z.string(), rollNo: z.string().nullable() }).meta({ id: 'RosterEntry' });
const sessionView = z
  .object({
    id: z.string(),
    subject: ref,
    class: ref,
    date: z.iso.date(),
    slotId: z.string().nullable(),
    method: z.enum(['roll', 'code']),
    savedAt: z.iso.datetime().nullable(),
    codeOpen: z.boolean(),
    /** Active students of the class, plus anyone already recorded in this session. */
    roster: z.array(rosterEntry),
    absentIds: z.array(z.string()),
    /** Same device for two accounts during check-in (flagged, never rejected). */
    flaggedIds: z.array(z.string()),
  })
  .meta({ id: 'AttendanceSession' });
const summary = { present: z.number().int(), total: z.number().int(), pct: z.number().int(), status, text: z.string() };

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const rollNo = (u: { studentIdNo: string | null }) => u.studentIdNo?.slice(-3) ?? null; // PROTO shows the last 3 digits

const subjectSelect = {
  id: true,
  name: true,
  classId: true,
  termId: true,
  teacherId: true,
  term: { select: { endedAt: true } },
  class: { select: { name: true, classTeacherId: true, minAttendancePct: true, archivedAt: true } },
} satisfies Prisma.SubjectSelect;
type Sub = Prisma.SubjectGetPayload<{ select: typeof subjectSelect }>;

/** ARCH §3: the subject's teacher, the class teacher, or an admin. Never the CR (the routes sit behind staff()). */
const canTeach = (s: Sub, user: AuthUser) => user.isAdmin || s.teacherId === user.id || s.class.classTeacherId === user.id;

/** Take or correct attendance for `s` on `date`: today or yesterday (paper days) unless admin. */
const assertTeach = (s: Sub, user: AuthUser, date: Date) => {
  if (!canTeach(s, user)) throw new HttpError(403, 'FORBIDDEN', "Only this subject's teacher or the class teacher takes its attendance");
  if (date > today()) throw new HttpError(422, 'VALIDATION', 'Attendance cannot be taken for a future date');
  if (user.isAdmin) return;
  if (s.term.endedAt || s.class.archivedAt) throw new HttpError(409, 'PAST_TERM', 'This term is closed');
  if (date < addDays(today(), -1)) throw new HttpError(403, 'TOO_OLD', 'Only today or yesterday can be filled in; ask the admin to correct older sessions');
};

const loadSession = async (id: string, user: AuthUser) => {
  const s = await db.attendanceSession.findUnique({ where: { id }, include: { subject: { select: subjectSelect } } });
  if (!s) throw new HttpError(404, 'NOT_FOUND', 'Session not found');
  assertTeach(s.subject, user, s.date);
  return s;
};

/** Active students of the class, plus anyone with matching Attendance rows: history outlives membership (AD-01). */
const roster = (classId: string, history?: Prisma.AttendanceWhereInput, tx: Prisma.TransactionClient = db) =>
  tx.user.findMany({
    where: { OR: [{ status: 'active', memberships: { some: { classId, role: { in: ['student', 'cr'] } } } }, ...(history ? [{ attendance: { some: history } }] : [])] },
    select: { id: true, name: true, studentIdNo: true },
    orderBy: [{ studentIdNo: 'asc' }, { name: 'asc' }],
  });

/** Each student's standing in one subject, over saved sessions only (an open check-in isn't final). */
export const standing = async (subjectId: string, studentIds: string[], min: number, tx: Prisma.TransactionClient = db) => {
  const groups = await tx.attendance.groupBy({
    by: ['studentId', 'present'],
    where: { studentId: { in: studentIds }, session: { subjectId, savedAt: { not: null } } },
    _count: { _all: true },
  });
  const count = (id: string, present: boolean) => groups.find((g) => g.studentId === id && g.present === present)?._count._all ?? 0;
  return new Map(
    studentIds.map((id) => {
      const present = count(id, true);
      const total = present + count(id, false);
      return [id, { present, total, ...attendanceSummary(present, total, min) }];
    }),
  );
};

const view = async (id: string) => {
  const s = await db.attendanceSession.findUniqueOrThrow({
    where: { id },
    include: { subject: { select: { id: true, name: true, class: { select: { id: true, name: true } } } }, records: { select: { studentId: true, present: true, flagged: true } } },
  });
  const people = await roster(s.subject.class.id, { sessionId: id });
  return {
    id: s.id,
    subject: { id: s.subject.id, name: s.subject.name },
    class: s.subject.class,
    date: ymd(s.date),
    slotId: s.slotId,
    method: s.method,
    savedAt: s.savedAt,
    codeOpen: isOpen(s, Date.now()),
    roster: people.map((p) => ({ id: p.id, name: p.name, rollNo: rollNo(p) })),
    absentIds: s.records.filter((r) => !r.present).map((r) => r.studentId),
    flaggedIds: s.records.filter((r) => r.flagged).map((r) => r.studentId),
  };
};

// --- /attendance-sessions (staff only: students and the CR get 403) ---
const sessions = Router();
sessions.use(staff());

sessions.post(
  '/',
  route(registry, {
    method: 'post',
    path: '/attendance-sessions',
    summary: 'Open or fetch the session for a subject/date/slot (idempotent); today or yesterday unless admin',
    guard: 'teach',
    request: { body: z.object({ subjectId: z.string().min(1), date: z.iso.date(), slotId: z.string().min(1).optional() }) },
    responses: { 200: sessionView, 403: null, 404: null, 409: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const body = req.body as { subjectId: string; date: string; slotId?: string };
    const date = new Date(body.date);
    const slotId = body.slotId ?? null;
    const subject = await db.subject.findUnique({ where: { id: body.subjectId }, select: subjectSelect });
    if (!subject) throw new HttpError(404, 'NOT_FOUND', 'Subject not found');
    assertTeach(subject, me, date);
    if (slotId && !(await db.timetableSlot.findFirst({ where: { id: slotId, subjectId: subject.id } })))
      throw new HttpError(422, 'VALIDATION', "That slot isn't this subject's");
    const id = await db.$transaction(async (tx) => {
      // The frozen schema has no unique (subject, date, slot): a per-subject lock keeps a double tap to one session.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${subject.id}))`;
      const found = await tx.attendanceSession.findFirst({ where: { subjectId: subject.id, date, slotId }, select: { id: true } });
      return found?.id ?? (await tx.attendanceSession.create({ data: { termId: subject.termId, subjectId: subject.id, date, slotId }, select: { id: true } })).id;
    });
    res.json(await view(id));
  },
);

sessions.put(
  '/:id',
  route(registry, {
    method: 'put',
    path: '/attendance-sessions/:id',
    summary: 'Save: everyone not in absentIds is present. Changing a saved row (or any admin save) is audited',
    guard: 'teach',
    request: { params: idParams, body: z.object({ absentIds: z.array(z.string().min(1)).max(1000) }) },
    responses: { 200: sessionView, 403: null, 404: null, 409: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const id = String(req.params.id);
    const s = await loadSession(id, me);
    const absent = new Set((req.body as { absentIds: string[] }).absentIds);
    const ids = (await roster(s.subject.classId, { sessionId: id })).map((p) => p.id);
    if ([...absent].some((a) => !ids.includes(a))) throw new HttpError(422, 'VALIDATION', "Some absentIds aren't on this class's roster");
    const min = s.subject.class.minAttendancePct;

    await db.$transaction(async (tx) => {
      const before = await standing(s.subjectId, ids, min, tx);
      const old = new Map((await tx.attendance.findMany({ where: { sessionId: id }, select: { studentId: true, present: true } })).map((r) => [r.studentId, r.present]));
      const changed = ids.filter((sid) => old.has(sid) && old.get(sid) === absent.has(sid));
      await tx.attendance.createMany({
        data: ids.filter((sid) => !old.has(sid)).map((studentId) => ({ sessionId: id, studentId, present: !absent.has(studentId), source: 'teacher' as const })),
      });
      for (const present of [true, false]) {
        const flip = changed.filter((sid) => absent.has(sid) !== present);
        if (flip.length) await tx.attendance.updateMany({ where: { sessionId: id, studentId: { in: flip } }, data: { present, source: 'teacher' } });
      }
      await tx.attendanceSession.update({ where: { id }, data: { savedAt: new Date(), savedById: me.id } });
      if ((s.savedAt && changed.length) || me.isAdmin) {
        const was = ids.filter((sid) => old.get(sid) === false);
        await audit(me, { action: 'attendance.correct', classId: s.subject.classId, targetType: 'AttendanceSession', targetId: id, before: { absentIds: was }, after: { absentIds: [...absent] } }, tx);
      }
      const after = await standing(s.subjectId, ids, min, tx);
      const dropped = ids.filter((sid) => before.get(sid)!.pct >= min && after.get(sid)!.pct < min);
      for (const sid of dropped) {
        const a = after.get(sid)!;
        await notify([sid], 'attendance-low', { subjectId: s.subjectId, subjectName: s.subject.name, classId: s.subject.classId, pct: a.pct, min, text: a.text }, tx);
      }
    });
    res.json(await view(id));
  },
);

// CS-10: the rotating code. The teacher's PUT save stays final: once saved, the window is shut (isOpen).
sessions.post(
  '/:id/code',
  route(registry, {
    method: 'post',
    path: '/attendance-sessions/:id/code',
    summary: "Use code: open a 2-minute check-in window for today's unsaved session; everyone starts absent-pending",
    guard: 'teach',
    request: { params: idParams },
    responses: { 200: z.object({ windowEndsAt: z.iso.datetime() }), 403: null, 404: null, 409: null },
  }),
  async (req, res) => {
    const id = String(req.params.id);
    const s = await loadSession(id, req.user!);
    if (s.date.getTime() !== today().getTime()) throw new HttpError(409, 'NOT_TODAY', "Check-in codes are for today's sessions");
    if (s.savedAt) throw new HttpError(409, 'ALREADY_SAVED', 'This session is saved; tap students to correct it');
    const people = await roster(s.subject.classId);
    const openedAt = new Date();
    await db.$transaction([
      db.attendance.deleteMany({ where: { sessionId: id } }),
      db.attendance.createMany({ data: people.map((p) => ({ sessionId: id, studentId: p.id, present: false, source: 'teacher' as const })) }),
      db.attendanceSession.update({ where: { id }, data: { method: 'code', codeSecret: newSecret(), codeOpenedAt: openedAt } }),
    ]);
    res.json({ windowEndsAt: new Date(openedAt.getTime() + WINDOW_MS) });
  },
);

sessions.get(
  '/:id/code',
  route(registry, {
    method: 'get',
    path: '/attendance-sessions/:id/code',
    summary: 'The code on screen (polled every 2s): null once the window is over or the session is saved',
    guard: 'teach',
    request: { params: idParams },
    responses: {
      200: z.object({ code: z.string().nullable(), secondsLeft: z.number().int(), windowEndsAt: z.iso.datetime(), checkedIn: z.array(z.string()), flagged: z.array(z.string()) }),
      403: null,
      404: null,
      409: null,
    },
  }),
  async (req, res) => {
    const id = String(req.params.id);
    const s = await loadSession(id, req.user!);
    if (!s.codeSecret || !s.codeOpenedAt) throw new HttpError(409, 'NO_CODE', 'No check-in code was opened for this session');
    const now = Date.now();
    const open = isOpen(s, now);
    const rows = await db.attendance.findMany({ where: { sessionId: id, OR: [{ source: 'code', present: true }, { flagged: true }] }, select: { studentId: true, source: true, present: true, flagged: true } });
    res.json({
      code: open ? codeAt(s.codeSecret, stepAt(s.codeOpenedAt, now)) : null,
      secondsLeft: open ? secondsLeft(s.codeOpenedAt, now) : 0,
      windowEndsAt: new Date(s.codeOpenedAt.getTime() + WINDOW_MS),
      checkedIn: rows.filter((r) => r.source === 'code' && r.present).map((r) => r.studentId),
      flagged: rows.filter((r) => r.flagged).map((r) => r.studentId),
    });
  },
);

// --- /checkin (students) ---
const checkin = Router();

checkin.post(
  '/',
  auth(),
  route(registry, {
    method: 'post',
    path: '/checkin',
    summary: "Check in with the code on the teacher's screen; one device for two accounts flags both (never rejects)",
    guard: 'auth',
    request: { body: z.object({ code: z.string().regex(/^\d{4}$/) }) },
    responses: { 200: z.object({ sessionId: z.string(), subject: ref }), 403: null, 429: null },
  }),
  async (req, res) => {
    const me = req.user!;
    if (me.role !== 'student') throw new HttpError(403, 'FORBIDDEN', 'Only students check in');
    const now = Date.now();
    if (!takeGuess(me.id, now)) throw new HttpError(429, 'RATE_LIMITED', 'Too many attempts, try again in a minute');
    const open = await db.attendanceSession.findMany({
      where: { date: today(), codeOpenedAt: { gt: new Date(now - WINDOW_MS) }, subject: { class: { members: { some: { userId: me.id, role: { in: ['student', 'cr'] } } } } } },
      select: { id: true, codeSecret: true, codeOpenedAt: true, savedAt: true, subject: { select: { id: true, name: true } } },
    });
    const { code } = req.body as { code: string };
    const s = open.find((o) => isOpen(o, now) && codeMatches(o.codeSecret!, o.codeOpenedAt!, now, code));
    if (!s) throw new HttpError(422, 'BAD_CODE', "That code didn't match");
    refundGuess(me.id);
    const deviceId = req.deviceId ?? null;
    await db.$transaction(async (tx) => {
      const others = deviceId ? await tx.attendance.findMany({ where: { sessionId: s.id, deviceId, studentId: { not: me.id } }, select: { id: true } }) : [];
      const flagged = others.length > 0;
      await tx.attendance.upsert({
        where: { sessionId_studentId: { sessionId: s.id, studentId: me.id } },
        create: { sessionId: s.id, studentId: me.id, present: true, source: 'code', deviceId, flagged },
        update: { present: true, source: 'code', deviceId, ...(flagged && { flagged }) },
      });
      if (flagged) await tx.attendance.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { flagged: true } });
    });
    res.json({ sessionId: s.id, subject: s.subject });
  },
);

/** A student's standing per subject of their active term (also used by /me/today). */
export const myAttendance = async (me: AuthUser) => {
  const subjects = await db.subject.findMany({
    where: { term: { endedAt: null }, class: { members: { some: { userId: me.id, role: { in: ['student', 'cr'] } } } } },
    select: { id: true, name: true, code: true, class: { select: { id: true, name: true, minAttendancePct: true } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const rows = await db.attendance.findMany({
    where: { studentId: me.id, session: { subjectId: { in: subjects.map((s) => s.id) }, savedAt: { not: null } } },
    select: { present: true, session: { select: { subjectId: true, date: true } } },
    orderBy: [{ session: { date: 'asc' } }, { session: { createdAt: 'asc' } }],
  });
  return subjects.map(({ class: { minAttendancePct: min, ...cls }, ...subject }) => {
    const own = rows.filter((r) => r.session.subjectId === subject.id);
    const present = own.filter((r) => r.present).length;
    return {
      subject,
      class: cls,
      min,
      present,
      total: own.length,
      ...attendanceSummary(present, own.length, min),
      history: own.slice(-12).map((r) => ({ date: ymd(r.session.date), present: r.present })),
    };
  });
};

// --- /me/attendance (students: their own only) ---
const mine = Router();

mine.get(
  '/',
  auth(),
  route(registry, {
    method: 'get',
    path: '/me/attendance',
    summary: 'My attendance per subject of the active term, with the last 12 sessions',
    guard: 'auth',
    responses: {
      200: z.object({
        items: z.array(
          z.object({ subject: ref.extend({ code: z.string().nullable() }), class: ref, min: z.number().int(), ...summary, history: z.array(z.object({ date: z.iso.date(), present: z.boolean() })) }),
        ),
      }),
      403: null,
    },
  }),
  async (req, res) => {
    const me = req.user!;
    if (me.role !== 'student') throw new HttpError(403, 'FORBIDDEN', 'Only students have attendance');
    res.json({ items: await myAttendance(me) });
  },
);

// --- /classes/:id/attendance (the subject's teacher or the class teacher; the CR gets 403 from classAccess) ---
const classAttendance = Router({ mergeParams: true });

classAttendance.get(
  '/',
  classAccess('id', 'teach'),
  route(registry, {
    method: 'get',
    path: '/classes/:id/attendance',
    summary: 'One subject: every student lowest first, and how many are below the minimum',
    guard: 'teach',
    request: { params: idParams, query: z.object({ subjectId: z.string().min(1) }) },
    responses: {
      200: z.object({ subject: ref, min: z.number().int(), belowCount: z.number().int(), rows: z.array(z.object({ student: rosterEntry, ...summary })) }),
      403: null,
      404: null,
    },
  }),
  async (req, res) => {
    const me = req.user!;
    const classId = String(req.params.id);
    const { subjectId } = req.query as { subjectId: string };
    const subject = await db.subject.findFirst({ where: { id: subjectId, classId }, select: subjectSelect });
    if (!subject) throw new HttpError(404, 'NOT_FOUND', 'Subject not found');
    if (!canTeach(subject, me)) throw new HttpError(403, 'FORBIDDEN', "Only this subject's teacher or the class teacher sees its attendance");
    const min = subject.class.minAttendancePct;
    const people = await roster(classId, { session: { subjectId } });
    const stand = await standing(subjectId, people.map((p) => p.id), min);
    const rows = people
      .map((p) => ({ student: { id: p.id, name: p.name, rollNo: rollNo(p) }, ...stand.get(p.id)! }))
      .sort((a, b) => a.pct - b.pct || a.student.name.localeCompare(b.student.name));
    res.json({ subject: { id: subject.id, name: subject.name }, min, belowCount: rows.filter((r) => r.pct < min).length, rows });
  },
);

const router = Router({ mergeParams: true });
router.use((req, res, next) => {
  const mount = req.baseUrl.split('/').pop();
  const sub = mount === 'attendance-sessions' ? sessions : mount === 'checkin' ? checkin : req.params.id ? classAttendance : mine;
  sub(req, res, next);
});
// Otherwise /me/attendance/* would fall through to the /me router.
router.use(notFound);
export default router;
