import { Router } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../../lib/auth.js';
import { addDays, today } from '../../lib/dates.js';
import { db } from '../../lib/db.js';
import { registry, route } from '../../lib/openapi.js';

// CS-11: exams + deadlines (board), assignments (posts) and a teacher's private reminders, soonest first (SPEC §7.3/§7.4).

const iso = (d: Date) => d.toISOString().slice(0, 10);

export const upcomingItem = z
  .object({
    kind: z.enum(['exam', 'deadline', 'assignment', 'reminder']),
    title: z.string(),
    date: z.iso.date(),
    classId: z.string().nullable(),
    /** The board item, post or reminder id. */
    ref: z.string(),
  })
  .meta({ id: 'UpcomingItem' });
export type UpcomingItem = z.infer<typeof upcomingItem>;

/** Today..today+days (inclusive) for a student's class, or for a teacher's own subjects/posts/reminders. */
export const upcoming = async (user: AuthUser, days: number): Promise<UpcomingItem[]> => {
  const from = today();
  const to = addDays(from, days);
  const staff = user.role !== 'student';
  const active = { term: { endedAt: null } };
  let classIds: string[];
  let mySubjects: Set<string> | null = null; // staff: only exams/deadlines of their subjects, or any in a class they lead
  let leads = new Set<string>();
  if (staff) {
    const [subjects, led] = await Promise.all([
      db.subject.findMany({ where: { teacherId: user.id, ...active }, select: { id: true, classId: true } }),
      db.class.findMany({ where: { classTeacherId: user.id, archivedAt: null }, select: { id: true } }),
    ]);
    mySubjects = new Set(subjects.map((s) => s.id));
    leads = new Set(led.map((c) => c.id));
    classIds = [...new Set([...subjects.map((s) => s.classId), ...leads])];
  } else {
    classIds = (await db.classMember.findMany({ where: { userId: user.id, role: { in: ['student', 'cr'] } }, select: { classId: true } })).map((m) => m.classId);
  }

  const [board, posts, reminders] = await Promise.all([
    db.boardItem.findMany({ where: { classId: { in: classIds }, kind: { in: ['exam', 'deadline'] }, date: { gte: from, lte: to }, ...active } }),
    db.post.findMany({
      // dueAt is an instant: fetch a day either side, then cut by the institution date below.
      where: { kind: 'assignment', dueAt: { gte: addDays(from, -1), lte: addDays(to, 2) }, targets: { some: { classId: { in: classIds } } }, ...(staff && { authorId: user.id }) },
      include: { targets: { select: { classId: true } } },
    }),
    user.role === 'staff' ? db.reminder.findMany({ where: { teacherId: user.id, date: { gte: from, lte: to } } }) : [],
  ]);

  const items: UpcomingItem[] = [];
  for (const b of board)
    if (!mySubjects || !b.subjectId || mySubjects.has(b.subjectId) || leads.has(b.classId))
      items.push({ kind: b.kind as 'exam' | 'deadline', title: b.title, date: iso(b.date!), classId: b.classId, ref: b.id });
  for (const p of posts) {
    const date = iso(today(undefined, p.dueAt!));
    if (date >= iso(from) && date <= iso(to)) items.push({ kind: 'assignment', title: p.title, date, classId: p.targets.find((t) => classIds.includes(t.classId))!.classId, ref: p.id });
  }
  for (const r of reminders) items.push({ kind: 'reminder', title: r.title, date: iso(r.date), classId: null, ref: r.id });
  return items.sort((a, b) => a.date.localeCompare(b.date));
};

export const upcomingRouter = Router();

upcomingRouter.get(
  '/upcoming',
  route(registry, {
    method: 'get',
    path: '/me/upcoming',
    summary: 'Exams, deadlines and assignments for the next 14 or 30 days, soonest first; a teacher also gets their private reminders',
    guard: 'auth',
    request: { query: z.object({ days: z.coerce.number().pipe(z.union([z.literal(14), z.literal(30)])).optional() }) },
    responses: { 200: z.object({ days: z.number().int(), items: z.array(upcomingItem) }) },
  }),
  async (req, res) => {
    const days = (req.query as { days?: number }).days ?? 14;
    res.json({ days, items: await upcoming(req.user!, days) });
  },
);
