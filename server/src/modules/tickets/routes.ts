import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../../lib/audit.js';
import { auth, perUser } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { HttpError, page, pageQuery, paginate } from '../../lib/http.js';
import { notify } from '../../lib/notify.js';
import { registry, route } from '../../lib/openapi.js';

// AD-05 (D6): any student or teacher opens a ticket to the admin inbox. Owners see only their own
// (others' → 404, so existence isn't leaked); admins see all. The admin side of the inbox is admin/inbox.ts.

const person = z.object({ id: z.string(), name: z.string() });
const ticketSummary = z
  .object({
    id: z.string(),
    category: z.enum(['account', 'class', 'attendance', 'commons', 'bug', 'other']),
    subject: z.string(),
    state: z.enum(['open', 'answered', 'closed']),
    from: person,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'TicketSummary' });
const ticket = ticketSummary
  .extend({
    body: z.string(),
    /** `fromAdmin` = written by someone other than the ticket's owner. */
    replies: z.array(z.object({ id: z.string(), body: z.string(), author: person, fromAdmin: z.boolean(), createdAt: z.iso.datetime() })),
  })
  .meta({ id: 'Ticket' });

const idParams = z.object({ id: z.string().min(1) });
const text = z.string().trim().min(1).max(4000);
const createBody = z.object({ category: ticketSummary.shape.category, subject: z.string().trim().min(1).max(140), body: text });
const replyBody = z.object({ body: text });

const from = { select: { id: true, name: true } } as const;
const include = { from, replies: { include: { author: from }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } } satisfies Prisma.TicketInclude;
type Row = NonNullable<Awaited<ReturnType<typeof findTicket>>>;
const findTicket = (id: string) => db.ticket.findUnique({ where: { id }, include });

const toSummary = (t: Omit<Row, 'replies'>): z.infer<typeof ticketSummary> => ({
  id: t.id,
  category: t.category,
  subject: t.subject,
  state: t.state,
  from: t.from,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
});
const toTicket = (t: Row): z.infer<typeof ticket> => ({
  ...toSummary(t),
  body: t.body,
  replies: t.replies.map((r) => ({ id: r.id, body: r.body, author: r.author, fromAdmin: r.authorId !== t.fromId, createdAt: r.createdAt.toISOString() })),
});

/** The ticket if `user` owns it or is an admin; otherwise 404 either way. */
const readable = async (id: string, user: { id: string; isAdmin: boolean }) => {
  const t = await findTicket(id);
  if (!t || (t.fromId !== user.id && !user.isAdmin)) throw new HttpError(404, 'NOT_FOUND', 'Ticket not found');
  return t;
};

const router = Router();
router.use(auth());

router.post(
  '/',
  perUser(30, 60_000),
  route(registry, {
    method: 'post',
    path: '/tickets',
    summary: 'Open a ticket to the admin inbox (students and staff)',
    guard: 'auth',
    request: { body: createBody },
    responses: { 201: ticket },
  }),
  async (req, res) => {
    const t = await db.ticket.create({ data: { ...(req.body as z.infer<typeof createBody>), fromId: req.user!.id }, include });
    res.status(201).json(toTicket(t));
  },
);

router.get(
  '/mine',
  route(registry, {
    method: 'get',
    path: '/tickets/mine',
    summary: 'My tickets, newest first',
    guard: 'auth',
    request: { query: pageQuery },
    responses: { 200: z.object({ items: z.array(ticketSummary), nextCursor: z.string().nullable() }) },
  }),
  async (req, res) => {
    const { cursor, limit } = req.query as unknown as z.infer<typeof pageQuery>;
    const rows = await db.ticket.findMany({
      where: { fromId: req.user!.id },
      include: { from },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...paginate(cursor, limit),
    });
    const p = page(rows, limit);
    res.json({ items: p.items.map(toSummary), nextCursor: p.nextCursor });
  },
);

router.get(
  '/:id',
  route(registry, {
    method: 'get',
    path: '/tickets/:id',
    summary: 'One ticket with its replies (the owner, or any admin)',
    guard: 'auth',
    request: { params: idParams },
    responses: { 200: ticket, 404: null },
  }),
  async (req, res) => {
    res.json(toTicket(await readable(req.params.id as string, req.user!)));
  },
);

router.post(
  '/:id/replies',
  perUser(30, 60_000),
  route(registry, {
    method: 'post',
    path: '/tickets/:id/replies',
    summary: "Reply: the owner's reply reopens an answered ticket; an admin's marks it answered and notifies the owner",
    guard: 'auth',
    request: { params: idParams, body: replyBody },
    responses: { 201: ticket, 404: null, 409: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const t = await readable(req.params.id as string, me);
    if (t.state === 'closed') throw new HttpError(409, 'TICKET_CLOSED', 'This ticket is closed');
    const { body } = req.body as z.infer<typeof replyBody>;
    // An admin replying to their own ticket is the owner here.
    const asAdmin = t.fromId !== me.id;
    const state = asAdmin ? 'answered' : 'open';
    await db.$transaction(async (tx) => {
      await tx.ticketReply.create({ data: { ticketId: t.id, authorId: me.id, body } });
      // Always touch the ticket so updatedAt tracks the last activity.
      await tx.ticket.update({ where: { id: t.id }, data: { state } });
      if (asAdmin) {
        await audit(me, { action: 'ticket.reply', targetType: 'Ticket', targetId: t.id, before: { state: t.state }, after: { state, body } }, tx);
        await notify([t.fromId], 'ticket-reply', { text: `${me.name} replied to your ticket "${t.subject}"`, ticketId: t.id }, tx);
      }
    });
    res.status(201).json(toTicket((await findTicket(t.id))!));
  },
);

export default router;
