import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { registry, route } from '../../lib/openapi.js';
import { institutionOf } from './school.js';

// AD-08: the admin home's numbers (PROTO admin.html overview) + D9 health. Mounted under /admin, behind admin().

const KINDS = ['ask', 'gig', 'market', 'lost', 'found'] as const;
const WEEK_MS = 7 * 86_400_000;
const named = z.object({ id: z.string(), name: z.string() });

const overview = z
  .object({
    studentsPerBranch: z.array(z.object({ branch: z.object({ id: z.string(), code: z.string(), name: z.string() }), students: z.number().int() })),
    /** Commons board posts created in the last 7 days, per kind. */
    boardPostsThisWeek: z.record(z.enum(KINDS), z.number().int()),
    openTickets: z.number().int(),
    openReports: z.number().int(),
    /** Unaccepted, unexpired invites (students and staff). */
    pendingInvites: z.number().int(),
    /** Live classes whose active term has no timetable slots yet (D9). */
    classesWithoutTimetable: z.array(named),
  })
  .meta({ id: 'AdminOverview' });

const router = Router();

router.get(
  '/overview',
  route(registry, {
    method: 'get',
    path: '/admin/overview',
    summary: 'Students per branch, board posts per kind this week, open tickets/reports, pending invites, classes without a timetable',
    guard: 'admin',
    responses: { 200: overview },
  }),
  async (req, res) => {
    const institutionId = await institutionOf(req.user!.id);
    const mine = { institutionId };
    const now = new Date();
    const [branches, posts, openTickets, openReports, pendingInvites, classesWithoutTimetable] = await Promise.all([
      db.branch.findMany({
        where: mine,
        select: { id: true, code: true, name: true, classes: { select: { _count: { select: { homeOf: { where: { role: 'student' } } } } } } },
        orderBy: { code: 'asc' },
      }),
      db.boardPost.groupBy({ by: ['kind'], where: { author: mine, createdAt: { gte: new Date(now.getTime() - WEEK_MS) } }, _count: { _all: true } }),
      db.ticket.count({ where: { state: 'open', from: mine } }),
      db.report.count({ where: { state: 'open', reporter: mine } }),
      db.invite.count({ where: { acceptedAt: null, expiresAt: { gt: now }, invitedBy: mine } }),
      db.class.findMany({
        where: { ...mine, archivedAt: null, terms: { some: { endedAt: null, slots: { none: {} } } } },
        select: { id: true, name: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
    ]);
    res.json({
      studentsPerBranch: branches.map(({ classes, ...branch }) => ({ branch, students: classes.reduce((n, c) => n + c._count.homeOf, 0) })),
      boardPostsThisWeek: Object.fromEntries(KINDS.map((k) => [k, posts.find((p) => p.kind === k)?._count._all ?? 0])),
      openTickets,
      openReports,
      pendingInvites,
      classesWithoutTimetable,
    });
  },
);

export default router;
