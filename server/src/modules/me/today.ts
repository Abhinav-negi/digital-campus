import { Router } from 'express';
import { z } from 'zod';
import { config } from '../../config.js';
import { today } from '../../lib/dates.js';
import { db } from '../../lib/db.js';
import { registry, route } from '../../lib/openapi.js';
import { myAttendance } from '../attendance/routes.js';
import { load, present, scheduleItem } from '../classes/schedule.js';
import { upcoming, upcomingItem } from './upcoming.js';

// CS-11: the Today screen (SPEC §7.3 student, §7.4 teacher), one shape per role. Schedule maths and clashes come from CS-05, attendance from CS-09.

const iso = (d: Date) => d.toISOString().slice(0, 10);
/** "HH:MM" in the institution's zone, comparable with slot times. */
const nowHHMM = () => new Intl.DateTimeFormat('en-GB', { timeZone: config.INSTITUTION_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());

const ref = z.object({ id: z.string(), name: z.string() });
const attendanceRow = z
  .object({
    subject: ref.extend({ code: z.string().nullable() }),
    class: ref,
    min: z.number().int(),
    present: z.number().int(),
    total: z.number().int(),
    pct: z.number().int(),
    status: z.enum(['safe', 'warn', 'danger']),
    text: z.string(),
    history: z.array(z.object({ date: z.iso.date(), present: z.boolean() })),
  })
  .meta({ id: 'TodayAttendance' });
const unreadPost = z
  .object({ id: z.string(), kind: z.enum(['announcement', 'assignment']), title: z.string(), createdAt: z.date(), author: ref })
  .meta({ id: 'UnreadPost' });
const session = scheduleItem.extend({ class: ref, attendanceDone: z.boolean(), canEdit: z.boolean() }).meta({ id: 'TodaySession' });
const studentToday = z
  .object({
    date: z.iso.date(),
    cancelled: z.array(scheduleItem),
    current: scheduleItem.nullable(),
    next: scheduleItem.nullable(),
    items: z.array(scheduleItem),
    attendance: z.array(attendanceRow),
    upcoming: z.array(upcomingItem),
    unreadPosts: z.array(unreadPost),
    /** Drives the D9 placeholders: no timetable yet / no subjects yet. */
    empty: z.object({ timetable: z.boolean(), subjects: z.boolean() }),
  })
  .meta({ id: 'StudentToday' });
const staffToday = z.object({ date: z.iso.date(), sessions: z.array(session), upcoming: z.array(upcomingItem) }).meta({ id: 'StaffToday' });
const todayResponse = z.union([studentToday, staffToday]);

export const todayRouter = Router();

todayRouter.get(
  '/today',
  route(registry, {
    method: 'get',
    path: '/me/today',
    summary: "Student: today's schedule (with cancellations and clashes), attendance, upcoming (14d), unread posts. Staff: today's sessions across all their classes, upcoming (7d)",
    guard: 'auth',
    responses: { 200: todayResponse },
  }),
  async (req, res) => {
    const me = req.user!;
    const date = today();
    const active = { term: { endedAt: null } };

    if (me.role !== 'student') {
      const subjects = await db.subject.findMany({ where: { teacherId: me.id, ...active }, select: { classId: true } });
      const led = await db.class.findMany({ where: { classTeacherId: me.id, archivedAt: null }, select: { id: true } });
      const classIds = new Set(subjects.map((s) => s.classId));
      const ledIds = new Set(led.map((c) => c.id));
      // `load` spans every class that shares a teacher with the one given, so one of mine reaches them all.
      const start = [...classIds][0];
      const [w, done, up] = await Promise.all([
        start ? load(db, start, date, date) : null,
        db.attendanceSession.findMany({ where: { date, savedAt: { not: null }, subject: { teacherId: me.id, ...active } }, select: { subjectId: true, slotId: true } }),
        upcoming(me, 7),
      ]);
      const items = w?.days[0]?.items ?? [];
      const sessions = items
        .filter((i) => i.teacherId === me.id)
        .map((i) => ({
          ...present(w!, items, i),
          class: { id: i.classId, name: w!.classNames.get(i.classId) ?? '' },
          attendanceDone: !i.off && done.some((s) => s.subjectId === i.subjectId && (!i.slotId || s.slotId === i.slotId)),
          canEdit: me.isAdmin || ledIds.has(i.classId) || i.teacherId === me.id,
        }));
      res.json({ date: iso(date), sessions, upcoming: up });
      return;
    }

    const member = await db.classMember.findFirst({ where: { userId: me.id, role: { in: ['student', 'cr'] } }, select: { classId: true }, orderBy: { createdAt: 'asc' } });
    const classId = member?.classId;
    const [w, subjects, slots, att, up, unread] = await Promise.all([
      classId ? load(db, classId, date, date) : null,
      classId ? db.subject.count({ where: { classId, ...active } }) : 0,
      classId ? db.timetableSlot.count({ where: { classId, ...active } }) : 0,
      myAttendance(me),
      upcoming(me, 14),
      db.post.findMany({
        where: { targets: { some: { class: { members: { some: { userId: me.id } } } } }, seen: { none: { userId: me.id } } },
        select: { id: true, kind: true, title: true, createdAt: true, author: { select: { id: true, name: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
      }),
    ]);
    const all = w?.days[0]?.items ?? [];
    // Another class's items only matter for clash maths; a student sees their own class (and its clashes).
    const items = all
      .filter((i) => i.classId === classId)
      .map((i) => {
        const p = present(w!, all, i);
        return { ...p, clashWith: p.clashWith.filter((c) => c.classId === classId) };
      });
    const live = items.filter((i) => !i.off && i.kind !== 'event');
    const now = nowHHMM();
    res.json({
      date: iso(date),
      cancelled: items.filter((i) => i.change?.kind === 'cancelled'),
      current: live.find((i) => i.start <= now && now < i.end) ?? null,
      next: live.find((i) => i.start > now) ?? null,
      items,
      attendance: att,
      upcoming: up,
      unreadPosts: unread,
      empty: { timetable: slots === 0, subjects: subjects === 0 },
    });
  },
);
