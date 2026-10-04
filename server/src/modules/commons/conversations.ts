import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../../lib/auth.js';
import { addDays, today } from '../../lib/dates.js';
import { db } from '../../lib/db.js';
import { HttpError, page, pageQuery, paginate } from '../../lib/http.js';
import { notify } from '../../lib/notify.js';
import { registry, route } from '../../lib/openapi.js';
import { findPost, sameDay, studentOnly } from './board.js';
import { effective, viewerOf } from './profiles.js';
import { blockedEitherWay, blockedIds } from './safety.js';

// CM-06: message requests + conversations (SPEC §9.7, §9.2; PROTO student.html:345-354, :466-473, :509-516).
// Blocks are CM-07's (safety.ts): the "blocked either way" rule lives there.

const DAILY_REQUESTS = 5;
const IGNORED_DAYS = 7;
const POST_KINDS = ['gig', 'market', 'lost', 'found'];

const idParams = z.object({ id: z.string().min(1) });
type Id = z.infer<typeof idParams>;

const person = z.object({ id: z.string(), name: z.string() }).meta({ id: 'ConversationPerson' });
const conversationItem = z
  .object({
    id: z.string(),
    state: z.enum(['requested', 'accepted', 'ignored']),
    /** The opening line (the request note, or the post-linked default). */
    note: z.string(),
    /** The other side; for an admin reading, the sender. */
    with: person,
    fromMe: z.boolean(),
    post: z.object({ id: z.string(), title: z.string() }).nullable(),
    /** ISO instant of the last message, or of the opening line. */
    lastAt: z.iso.datetime(),
    lastMessage: z.string().nullable(),
  })
  .meta({ id: 'ConversationItem' });
const conversationList = z
  .object({ incoming: z.array(conversationItem), conversations: z.array(conversationItem), outgoing: z.array(conversationItem) })
  .meta({ id: 'ConversationList' });
const message = z
  .object({ id: z.string(), senderId: z.string(), body: z.string(), createdAt: z.iso.datetime() })
  .meta({ id: 'ConversationMessage' });
const messagePage = z.object({ items: z.array(message), nextCursor: z.string().nullable() }).meta({ id: 'ConversationMessagePage' });

const include = {
  from: { select: { id: true, name: true } },
  to: { select: { id: true, name: true } },
  post: { select: { id: true, title: true } },
  messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, createdAt: true } },
} satisfies Prisma.ConversationInclude;
type Row = Prisma.ConversationGetPayload<{ include: typeof include }>;

/** The sender of an ignored request is never told (SPEC §9.7): it reads as still requested. */
const item = (c: Row, me: string): z.infer<typeof conversationItem> => {
  const fromMe = c.fromId === me;
  const last = c.messages[0];
  return {
    id: c.id,
    state: fromMe && c.state === 'ignored' ? 'requested' : c.state,
    note: c.note,
    with: fromMe ? c.to : c.from,
    fromMe,
    post: c.post,
    lastAt: (last?.createdAt ?? c.createdAt).toISOString(),
    lastMessage: last?.body ?? null,
  };
};

/** An active, unbanned student of my institution (not me); 404 otherwise. */
const findTarget = async (me: AuthUser, id: string) => {
  const viewer = await viewerOf(me.id);
  const u = await db.user.findFirst({
    where: { id, role: 'student', status: 'active', bannedAt: null, institutionId: viewer.institutionId },
    select: { id: true, name: true, profile: { select: { availability: true, focusUntil: true } } },
  });
  if (!u) throw new HttpError(404, 'NOT_FOUND', 'Person not found');
  if (u.id === me.id) throw new HttpError(422, 'VALIDATION', 'You cannot message yourself');
  return u;
};

/** A conversation I may see: a participant, or an admin when only reading (D2). 404 if missing, 403 for anyone else. */
const findConversation = async (id: string, me: AuthUser, read = false) => {
  const c = await db.conversation.findUnique({ where: { id }, include });
  if (!c) throw new HttpError(404, 'NOT_FOUND', 'Conversation not found');
  if (!(read && me.isAdmin) && c.fromId !== me.id && c.toId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Not your conversation');
  return c;
};

const router = Router();

const requestBody = z.object({ toId: z.string().min(1), note: z.string().trim().min(1).max(500) });
router.post(
  '/conversations',
  route(registry, {
    method: 'post',
    path: '/commons/conversations',
    summary: 'Send a cold message request (max 5 a day; not to someone in Focus, blocked either way, or with an existing conversation)',
    guard: 'commons',
    request: { body: requestBody },
    responses: { 201: conversationItem, 403: null, 404: null, 409: null, 429: null },
  }),
  async (req, res) => {
    const me = req.user!;
    studentOnly(me);
    const { toId, note } = req.body as z.infer<typeof requestBody>;
    const to = await findTarget(me, toId);
    if (await blockedEitherWay(me.id, to.id)) throw new HttpError(403, 'BLOCKED', 'You cannot message this person');
    if (to.profile && effective(to.profile) === 'focus') throw new HttpError(403, 'IN_FOCUS', `${to.name} is in Focus mode and not taking requests`);
    const pair = { OR: [{ fromId: me.id, toId: to.id }, { fromId: to.id, toId: me.id }] };
    if (await db.conversation.count({ where: pair })) throw new HttpError(409, 'CONFLICT', 'You already have a conversation with this person');
    // The cap counts cold requests by institution-timezone day (post-linked messages are not requests).
    const recent = await db.conversation.findMany({ where: { fromId: me.id, postId: null, createdAt: { gte: addDays(today(), -1) } }, select: { createdAt: true } });
    if (recent.filter((c) => sameDay(c.createdAt)).length >= DAILY_REQUESTS)
      throw new HttpError(429, 'RATE_LIMITED', `You have used your ${DAILY_REQUESTS} requests for today`);
    const c = await db.$transaction(async (tx) => {
      const c = await tx.conversation.create({ data: { fromId: me.id, toId: to.id, note }, include });
      await notify([to.id], 'message-request', { text: `${me.name} sent you a message request`, conversationId: c.id }, tx);
      return c;
    });
    res.status(201).json(item(c, me.id));
  },
);

router.post(
  '/board-posts/:id/message',
  route(registry, {
    method: 'post',
    path: '/commons/board-posts/:id/message',
    summary: "Message a gig/market/lost/found poster: opens an accepted conversation at once, even if they are in Focus (reused if it exists)",
    guard: 'commons',
    request: { params: idParams },
    responses: { 200: conversationItem, 201: conversationItem, 403: null, 404: null },
  }),
  async (req, res) => {
    const me = req.user!;
    studentOnly(me);
    const { p } = await findPost((req.params as Id).id, me);
    if (!POST_KINDS.includes(p.kind)) throw new HttpError(422, 'VALIDATION', 'Asks are answered publicly');
    if (p.authorId === me.id) throw new HttpError(403, 'FORBIDDEN', "That's your own post");
    if (await blockedEitherWay(me.id, p.authorId)) throw new HttpError(403, 'BLOCKED', 'You cannot message this person');
    const mine = { fromId: me.id, postId: p.id };
    const had = await db.conversation.findFirst({ where: mine, include });
    if (had) return void res.json(item(had, me.id));
    const note = p.kind === 'lost' ? `Hi, I think I found your ${p.title.toLowerCase()}.` : `Hi, is "${p.title}" still available?`;
    const c = await db.$transaction(async (tx) => {
      const c = await tx.conversation.create({ data: { ...mine, toId: p.authorId, note, state: 'accepted' }, include });
      await notify([p.authorId], 'message', { text: `${me.name} messaged you about "${p.title}"`, conversationId: c.id }, tx);
      return c;
    });
    res.status(201).json(item(c, me.id));
  },
);

router.get(
  '/conversations',
  route(registry, {
    method: 'get',
    path: '/commons/conversations',
    summary: 'My requests to answer, my open conversations and my sent requests (ignored ones read as pending, then drop after 7 days)',
    guard: 'commons',
    responses: { 200: conversationList },
  }),
  async (req, res) => {
    const me = req.user!.id;
    const blocked = await blockedIds(me);
    const rows = await db.conversation.findMany({
      where: { OR: [{ fromId: me }, { toId: me }], fromId: { notIn: blocked }, toId: { notIn: blocked }, NOT: { state: 'ignored', createdAt: { lt: addDays(new Date(), -IGNORED_DAYS) } } },
      include,
      orderBy: { createdAt: 'desc' },
    });
    const items = rows.map((c) => item(c, me));
    const byRecent = (a: { lastAt: string }, b: { lastAt: string }) => b.lastAt.localeCompare(a.lastAt);
    res.json({
      incoming: rows.filter((c) => c.toId === me && c.state === 'requested').map((c) => item(c, me)),
      conversations: items.filter((c) => c.state === 'accepted').sort(byRecent),
      outgoing: rows.filter((c) => c.fromId === me && c.state !== 'accepted').map((c) => item(c, me)),
    });
  },
);

const respondBody = z.object({ state: z.enum(['accepted', 'ignored']) });
router.post(
  '/conversations/:id/respond',
  route(registry, {
    method: 'post',
    path: '/commons/conversations/:id/respond',
    summary: 'The recipient accepts or ignores a pending request (the sender is told of an accept only)',
    guard: 'commons',
    request: { params: idParams, body: respondBody },
    responses: { 200: conversationItem, 403: null, 404: null, 409: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const c = await findConversation((req.params as Id).id, me);
    if (c.toId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the person asked can respond');
    if (c.state !== 'requested') throw new HttpError(409, 'CONFLICT', 'This request was already answered');
    const { state } = req.body as z.infer<typeof respondBody>;
    const out = await db.$transaction(async (tx) => {
      const out = await tx.conversation.update({ where: { id: c.id }, data: { state }, include });
      if (state === 'accepted') await notify([c.fromId], 'message-accepted', { text: `${me.name} accepted your message request`, conversationId: c.id }, tx);
      return out;
    });
    res.json(item(out, me.id));
  },
);

router.get(
  '/conversations/:id/messages',
  route(registry, {
    method: 'get',
    path: '/commons/conversations/:id/messages',
    summary: 'Messages of an accepted conversation, oldest first (participants; admins too). Poll with the last cursor',
    guard: 'commons',
    request: { params: idParams, query: pageQuery },
    responses: { 200: messagePage, 403: null, 404: null },
  }),
  async (req, res) => {
    const c = await findConversation((req.params as Id).id, req.user!, true);
    if (c.state !== 'accepted') throw new HttpError(403, 'FORBIDDEN', 'This conversation is not open');
    const { cursor, limit } = req.query as unknown as z.infer<typeof pageQuery>;
    const rows = await db.message.findMany({
      where: { conversationId: c.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, senderId: true, body: true, createdAt: true },
      ...paginate(cursor, limit),
    });
    const { items, nextCursor } = page(rows, limit);
    res.json({ items: items.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })), nextCursor });
  },
);

const sendBody = z.object({ body: z.string().trim().min(1).max(2000) });
router.post(
  '/conversations/:id/messages',
  route(registry, {
    method: 'post',
    path: '/commons/conversations/:id/messages',
    summary: 'Send a message in an accepted conversation (participants only; not if blocked either way)',
    guard: 'commons',
    request: { params: idParams, body: sendBody },
    responses: { 201: message, 403: null, 404: null },
  }),
  async (req, res) => {
    const me = req.user!;
    studentOnly(me);
    const c = await findConversation((req.params as Id).id, me);
    if (c.state !== 'accepted') throw new HttpError(403, 'FORBIDDEN', 'This conversation is not open');
    const other = c.fromId === me.id ? c.toId : c.fromId;
    if (await blockedEitherWay(me.id, other)) throw new HttpError(403, 'BLOCKED', 'You cannot message this person');
    const m = await db.$transaction(async (tx) => {
      const m = await tx.message.create({ data: { conversationId: c.id, senderId: me.id, body: (req.body as z.infer<typeof sendBody>).body } });
      await tx.conversation.update({ where: { id: c.id }, data: { updatedAt: new Date() } });
      await notify([other], 'message', { text: `${me.name} sent you a message`, conversationId: c.id }, tx);
      return m;
    });
    res.status(201).json({ id: m.id, senderId: m.senderId, body: m.body, createdAt: m.createdAt.toISOString() });
  },
);

export default router;
