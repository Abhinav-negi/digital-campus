import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../../lib/audit.js';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { registry, route } from '../../lib/openapi.js';

// AD-05 (D6): tickets and Commons reports in one list. Mounted under /admin, behind admin().
// Report actions are AD-06; replies go through POST /tickets/:id/replies (tickets/routes.ts).

const TICKET_STATES = ['open', 'answered', 'closed'] as const;
const REPORT_STATES = ['open', 'hidden', 'warned', 'dismissed'] as const;
const LIMIT = 100;

const person = z.object({ id: z.string(), name: z.string() });
const inboxItem = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('ticket'),
      id: z.string(),
      state: z.enum(TICKET_STATES),
      category: z.enum(['account', 'class', 'attendance', 'commons', 'bug', 'other']),
      subject: z.string(),
      from: person,
      createdAt: z.iso.datetime(),
    }),
    z.object({
      type: z.literal('report'),
      id: z.string(),
      state: z.enum(REPORT_STATES),
      targetType: z.enum(['board', 'project', 'challenge', 'message', 'profile']),
      targetId: z.string(),
      reason: z.string(),
      from: person,
      createdAt: z.iso.datetime(),
    }),
  ])
  .meta({ id: 'InboxItem' });

const inboxQuery = z.object({
  type: z.enum(['tickets', 'reports', 'all']).default('all'),
  state: z.enum(['open', 'answered', 'closed', 'hidden', 'warned', 'dismissed']).optional(),
});

const counts = <S extends string>(states: readonly S[], rows: { state: S; _count: { _all: number } }[]) =>
  Object.fromEntries(states.map((s) => [s, rows.find((r) => r.state === s)?._count._all ?? 0])) as Record<S, number>;

const router = Router();

router.get(
  '/inbox',
  route(registry, {
    method: 'get',
    path: '/admin/inbox',
    summary: `Tickets and reports in one list, newest first (at most ${LIMIT}), with counts per state`,
    guard: 'admin',
    request: { query: inboxQuery },
    responses: {
      200: z.object({
        items: z.array(inboxItem),
        counts: z.object({ tickets: z.record(z.enum(TICKET_STATES), z.number()), reports: z.record(z.enum(REPORT_STATES), z.number()) }),
      }),
    },
  }),
  async (req, res) => {
    const { type, state } = req.query as unknown as z.infer<typeof inboxQuery>;
    // A state only one kind has (e.g. `answered`) filters the other kind out entirely.
    const wantTickets = type !== 'reports' && (!state || (TICKET_STATES as readonly string[]).includes(state));
    const wantReports = type !== 'tickets' && (!state || (REPORT_STATES as readonly string[]).includes(state));
    const newest = { orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }], take: LIMIT };
    const from = { select: { id: true, name: true } };
    // ponytail: loads the newest LIMIT of each kind and merges in memory, no cursor; add a createdAt cursor when admins need past the newest 100.
    const [tickets, reports, ticketCounts, reportCounts] = await Promise.all([
      wantTickets ? db.ticket.findMany({ where: { state: state as (typeof TICKET_STATES)[number] | undefined }, include: { from }, ...newest }) : [],
      wantReports ? db.report.findMany({ where: { state: state as (typeof REPORT_STATES)[number] | undefined }, include: { reporter: from }, ...newest }) : [],
      db.ticket.groupBy({ by: ['state'], _count: { _all: true } }),
      db.report.groupBy({ by: ['state'], _count: { _all: true } }),
    ]);
    const items: z.infer<typeof inboxItem>[] = [
      ...tickets.map((t) => ({ type: 'ticket' as const, id: t.id, state: t.state, category: t.category, subject: t.subject, from: t.from, createdAt: t.createdAt })),
      ...reports.map((r) => ({ type: 'report' as const, id: r.id, state: r.state, targetType: r.targetType, targetId: r.targetId, reason: r.reason, from: r.reporter, createdAt: r.createdAt })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, LIMIT)
      .map((i) => ({ ...i, createdAt: i.createdAt.toISOString() }));
    res.json({ items, counts: { tickets: counts(TICKET_STATES, ticketCounts), reports: counts(REPORT_STATES, reportCounts) } });
  },
);

const stateBody = z.object({ state: z.enum(['open', 'closed']) });

router.patch(
  '/tickets/:id',
  route(registry, {
    method: 'patch',
    path: '/admin/tickets/:id',
    summary: 'Close a ticket (or reopen a closed one)',
    guard: 'admin',
    request: { params: z.object({ id: z.string().min(1) }), body: stateBody },
    responses: { 200: z.object({ id: z.string(), state: z.enum(TICKET_STATES) }), 404: null },
  }),
  async (req, res) => {
    const { state } = req.body as z.infer<typeof stateBody>;
    const t = await db.ticket.findUnique({ where: { id: req.params.id as string } });
    if (!t) throw new HttpError(404, 'NOT_FOUND', 'Ticket not found');
    if (t.state !== state)
      await db.$transaction(async (tx) => {
        await tx.ticket.update({ where: { id: t.id }, data: { state } });
        await audit(req.user!, { action: `ticket.${state === 'closed' ? 'close' : 'reopen'}`, targetType: 'Ticket', targetId: t.id, before: { state: t.state }, after: { state } }, tx);
      });
    res.json({ id: t.id, state });
  },
);

export default router;
