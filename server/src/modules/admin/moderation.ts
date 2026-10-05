import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../../lib/audit.js';
import { db } from '../../lib/db.js';
import { HttpError, page, pageQuery, paginate } from '../../lib/http.js';
import { notify } from '../../lib/notify.js';
import { registry, route } from '../../lib/openapi.js';
import { findConversation } from '../commons/conversations.js';
import { institutionOf } from './school.js';

// AD-06: Commons moderation, bans and audited conversation reading (ARCH §2 D2, SPEC §12). Mounted under /admin, behind admin().

const idParams = z.object({ id: z.string().min(1) });
const gone = (what: string) => new HttpError(404, 'NOT_FOUND', `${what} not found`);

// --- content (board-post | project | challenge | profile) ---
const TYPES = ['board-post', 'project', 'challenge', 'profile'] as const;
type Type = (typeof TYPES)[number];
const typeParams = z.object({ type: z.enum(TYPES), id: z.string().min(1) });
const AUDIT_TYPE = { 'board-post': 'BoardPost', project: 'Project', challenge: 'Challenge', profile: 'Profile' } as const;

// ponytail: "any field" is the text fields a moderator would fix; relations, ownership and counters stay out. Add keys here as needed.
const patchBodies = {
  'board-post': z.object({ title: z.string().trim().min(1).max(200), body: z.string().max(5000).nullable(), tags: z.array(z.string().max(40)).max(20), place: z.string().max(200).nullable(), condition: z.string().max(200).nullable() }),
  project: z.object({ title: z.string().trim().min(1).max(200), description: z.string().max(5000), roles: z.array(z.string().max(60)).max(20), repoUrl: z.url().nullable() }),
  challenge: z.object({ title: z.string().trim().min(1).max(200), description: z.string().max(5000) }),
  profile: z.object({ headline: z.string().max(200), skills: z.array(z.string().max(40)).max(30), helpsJuniors: z.boolean() }),
} as const;
const patchBody = z.object({ ...patchBodies['board-post'].partial().shape, ...patchBodies.project.partial().shape, ...patchBodies.profile.partial().shape }).partial(); // docs shape: the union of editable fields
const ok = z.object({ id: z.string() });

// One delegate shape for the three hideable models (as featured.ts does); profile has no hiddenAt, id or delete.
const model = (type: Type, tx: Prisma.TransactionClient = db) =>
  ({ 'board-post': tx.boardPost, project: tx.project, challenge: tx.challenge, profile: tx.profile })[type] as unknown as typeof tx.project;
const key = (type: Type) => (type === 'profile' ? 'userId' : 'id');
const find = async (type: Type, id: string) => {
  const x = await model(type).findFirst({ where: { [key(type)]: id } as { id: string } });
  if (!x) throw gone('Item');
  return x;
};
const hideable = (type: Type) => {
  if (type === 'profile') throw new HttpError(422, 'VALIDATION', 'A profile cannot be hidden or deleted; edit it or ban the user');
};
const router = Router();

router.patch(
  '/commons/:type/:id',
  route(registry, {
    method: 'patch',
    path: '/admin/commons/:type/:id',
    summary: 'Edit fields of any Commons board post, project, challenge or profile (audited with before/after)',
    guard: 'admin',
    request: { params: typeParams, body: patchBody },
    responses: { 200: ok, 404: null },
  }),
  async (req, res) => {
    const { type, id } = req.params as unknown as z.infer<typeof typeParams>;
    const parsed = patchBodies[type].partial().safeParse(req.body); // this type's fields only; others are dropped
    const data = (parsed.success ? parsed.data : {}) as Record<string, unknown>;
    if (!parsed.success || Object.keys(data).length === 0) throw new HttpError(422, 'VALIDATION', `Send at least one editable ${type} field`);
    const before = await find(type, id);
    const keys = Object.keys(data);
    await db.$transaction(async (tx) => {
      await model(type, tx).update({ where: { [key(type)]: id } as { id: string }, data });
      await audit(req.user!, { action: 'commons.edit', targetType: AUDIT_TYPE[type], targetId: id, before: Object.fromEntries(keys.map((k) => [k, (before as Record<string, unknown>)[k] ?? null])) as Prisma.InputJsonValue, after: data as Prisma.InputJsonValue }, tx);
    });
    res.json({ id });
  },
);

router.post(
  '/commons/:type/:id/unhide',
  route(registry, { method: 'post', path: '/admin/commons/:type/:id/unhide', summary: 'Show a hidden board post, project or challenge again (audited)', guard: 'admin', request: { params: typeParams }, responses: { 200: ok, 404: null, 422: null } }),
  async (req, res) => {
    const { type, id } = req.params as unknown as z.infer<typeof typeParams>;
    hideable(type);
    const x = (await find(type, id)) as { hiddenAt: Date | null };
    await db.$transaction(async (tx) => {
      await model(type, tx).update({ where: { id }, data: { hiddenAt: null } });
      await audit(req.user!, { action: 'commons.unhide', targetType: AUDIT_TYPE[type], targetId: id, before: { hiddenAt: x.hiddenAt?.toISOString() ?? null }, after: { hiddenAt: null } }, tx);
    });
    res.json({ id });
  },
);

router.delete(
  '/commons/:type/:id',
  route(registry, { method: 'delete', path: '/admin/commons/:type/:id', summary: 'Delete a board post, project or challenge (audited with a snapshot)', guard: 'admin', request: { params: typeParams }, responses: { 204: null, 404: null, 422: null } }),
  async (req, res) => {
    const { type, id } = req.params as unknown as z.infer<typeof typeParams>;
    hideable(type);
    const x = (await find(type, id)) as unknown as { title: string; ownerId?: string; authorId?: string };
    await db.$transaction(async (tx) => {
      await model(type, tx).delete({ where: { id } });
      await audit(req.user!, { action: 'commons.delete', targetType: AUDIT_TYPE[type], targetId: id, before: { title: x.title, ownerId: x.ownerId ?? x.authorId ?? null } }, tx);
    });
    res.status(204).end();
  },
);

// --- reports ---
const reportBody = z.object({ action: z.enum(['hide', 'warn', 'dismiss', 'delete']) });
type Target = { ownerId: string; title: string; hideable: boolean; hidden: boolean; kind: 'board' | 'project' | 'challenge' | 'message' | 'profile' };

/** The reported thing as it is now, or null when it is already gone. */
const reportTarget = async (type: string, id: string): Promise<Target | null> => {
  switch (type) {
    case 'board': {
      const p = await db.boardPost.findUnique({ where: { id }, select: { authorId: true, title: true, hiddenAt: true } });
      return p && { ownerId: p.authorId, title: p.title, hideable: true, hidden: !!p.hiddenAt, kind: 'board' };
    }
    case 'project':
    case 'challenge': {
      const p = await (type === 'project' ? db.project : (db.challenge as unknown as typeof db.project)).findUnique({ where: { id }, select: { ownerId: true, title: true, hiddenAt: true } });
      return p && { ownerId: p.ownerId, title: p.title, hideable: true, hidden: !!p.hiddenAt, kind: type };
    }
    case 'message': {
      const m = await db.message.findUnique({ where: { id }, select: { senderId: true } });
      return m && { ownerId: m.senderId, title: 'a message', hideable: false, hidden: false, kind: 'message' };
    }
    default: {
      const u = await db.user.findUnique({ where: { id }, select: { id: true, name: true } });
      return u && { ownerId: u.id, title: 'your profile', hideable: false, hidden: false, kind: 'profile' };
    }
  }
};
const REPORT_STATE = { hide: 'hidden', delete: 'hidden', warn: 'warned', dismiss: 'dismissed' } as const;

router.post(
  '/reports/:id',
  route(registry, {
    method: 'post',
    path: '/admin/reports/:id',
    summary: 'Resolve an open report: hide or delete the target, warn its author, or dismiss (un-hiding an auto-hidden target). Resolves every open report on that target; audited',
    guard: 'admin',
    request: { params: idParams, body: reportBody },
    responses: { 200: z.object({ id: z.string(), state: z.enum(['hidden', 'warned', 'dismissed']) }), 404: null, 409: null, 422: null },
  }),
  async (req, res) => {
    const { id } = req.params as z.infer<typeof idParams>;
    const { action } = req.body as z.infer<typeof reportBody>;
    const r = await db.report.findUnique({ where: { id } });
    if (!r) throw gone('Report');
    if (r.state !== 'open') throw new HttpError(409, 'CONFLICT', 'This report is already resolved');
    const t = await reportTarget(r.targetType, r.targetId);
    if (!t && action !== 'dismiss') throw new HttpError(409, 'CONFLICT', 'The reported item no longer exists');
    if (t && !t.hideable && (action === 'hide' || (action === 'delete' && t.kind === 'profile')))
      throw new HttpError(422, 'VALIDATION', `A ${t.kind} cannot be ${action === 'hide' ? 'hidden' : 'deleted'}; warn, dismiss or ban the user`);
    const state = REPORT_STATE[action];
    await db.$transaction(async (tx) => {
      const where = { id: r.targetId };
      const m = model(r.targetType === 'board' ? 'board-post' : r.targetType === 'project' ? 'project' : 'challenge', tx); // only used for those three
      if (t?.hideable && (action === 'hide' || action === 'dismiss')) await m.update({ where, data: { hiddenAt: action === 'hide' ? (t.hidden ? undefined : new Date()) : null } });
      if (t && action === 'delete') await (r.targetType === 'message' ? tx.message.delete({ where }) : m.delete({ where }));
      if (t && action === 'warn') await notify([t.ownerId], 'warning', { text: `An admin reviewed a report about ${t.title} and asks you to follow the community rules`, reportId: id }, tx);
      await tx.report.updateMany({ where: { targetType: r.targetType, targetId: r.targetId, state: 'open' }, data: { state } });
      await audit(req.user!, { action: `report.${action}`, targetType: r.targetType, targetId: r.targetId, before: { reportId: id, state: 'open', hidden: t?.hidden ?? null }, after: { state, reason: r.reason } }, tx);
    });
    res.json({ id, state });
  },
);

// --- bans ---
const banBody = z.object({ reason: z.string().trim().min(1).max(500), until: z.iso.datetime().optional() });
const findStudent = async (adminId: string, id: string) => {
  const u = await db.user.findFirst({ where: { id, role: 'student', institutionId: await institutionOf(adminId) }, select: { id: true, bannedAt: true } });
  if (!u) throw gone('Student');
  return u;
};

router.post(
  '/users/:id/ban',
  route(registry, {
    method: 'post',
    path: '/admin/users/:id/ban',
    summary: 'Ban a student from the Commons (403 BANNED there; the class space is unaffected). Reason and optional until are audited',
    guard: 'admin',
    request: { params: idParams, body: banBody },
    responses: { 200: z.object({ id: z.string(), bannedAt: z.iso.datetime() }), 404: null },
  }),
  async (req, res) => {
    const { id } = req.params as z.infer<typeof idParams>;
    const { reason, until } = req.body as z.infer<typeof banBody>;
    const u = await findStudent(req.user!.id, id);
    // ponytail: the schema has only bannedAt, so `until` is recorded in the audit row but not enforced; auto-expiry needs a User.bannedUntil column.
    const bannedAt = u.bannedAt ?? new Date();
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { bannedAt } });
      await audit(req.user!, { action: 'user.ban', targetType: 'User', targetId: id, before: { bannedAt: u.bannedAt?.toISOString() ?? null }, after: { bannedAt: bannedAt.toISOString(), reason, until: until ?? null } }, tx);
    });
    res.json({ id, bannedAt: bannedAt.toISOString() });
  },
);

router.delete(
  '/users/:id/ban',
  route(registry, { method: 'delete', path: '/admin/users/:id/ban', summary: 'Lift a Commons ban (idempotent; audited)', guard: 'admin', request: { params: idParams }, responses: { 204: null, 404: null } }),
  async (req, res) => {
    const { id } = req.params as z.infer<typeof idParams>;
    const u = await findStudent(req.user!.id, id);
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { bannedAt: null } });
      await audit(req.user!, { action: 'user.unban', targetType: 'User', targetId: id, before: { bannedAt: u.bannedAt?.toISOString() ?? null }, after: { bannedAt: null } }, tx);
    });
    res.status(204).end();
  },
);

// --- conversations (D2: admins read everything; every open is audited; read-only, no posting here) ---
const person = z.object({ id: z.string(), name: z.string() });
const convItem = z.object({ id: z.string(), state: z.enum(['requested', 'accepted', 'ignored']), from: person, to: person, note: z.string(), lastAt: z.iso.datetime(), lastMessage: z.string().nullable() }).meta({ id: 'AdminConversationItem' });
const convQuery = pageQuery.extend({ userId: z.string().min(1).optional(), q: z.string().trim().min(1).optional() });
const msg = z.object({ id: z.string(), senderId: z.string(), body: z.string(), createdAt: z.iso.datetime() }).meta({ id: 'AdminConversationMessage' });

router.get(
  '/conversations',
  route(registry, {
    method: 'get',
    path: '/admin/conversations',
    summary: 'Find conversations by participant and/or text (names, opening note, messages). Listing is metadata only; opening one is audited',
    guard: 'admin',
    request: { query: convQuery },
    responses: { 200: z.object({ items: z.array(convItem), nextCursor: z.string().nullable() }) },
  }),
  async (req, res) => {
    const { userId, q, cursor, limit } = req.query as unknown as z.infer<typeof convQuery>;
    const inst = { institutionId: await institutionOf(req.user!.id) };
    const text = q ? { contains: q, mode: 'insensitive' as const } : undefined;
    const rows = await db.conversation.findMany({
      where: {
        from: inst,
        ...(userId && { OR: [{ fromId: userId }, { toId: userId }] }),
        ...(text && { AND: [{ OR: [{ note: text }, { from: { name: text } }, { to: { name: text } }, { messages: { some: { body: text } } }] }] }),
      },
      include: { from: { select: { id: true, name: true } }, to: { select: { id: true, name: true } }, messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, createdAt: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...paginate(cursor, limit),
    });
    const { items, nextCursor } = page(rows, limit);
    res.json({
      items: items.map((c) => ({ id: c.id, state: c.state, from: c.from, to: c.to, note: c.note, lastAt: (c.messages[0]?.createdAt ?? c.createdAt).toISOString(), lastMessage: c.messages[0]?.body ?? null })),
      nextCursor,
    });
  },
);

router.get(
  '/conversations/:id/messages',
  route(registry, {
    method: 'get',
    path: '/admin/conversations/:id/messages',
    summary: 'Read a conversation in any state, oldest first. Every open writes an audit row ("Read conversation X"); read-only',
    guard: 'admin',
    request: { params: idParams, query: pageQuery },
    responses: { 200: z.object({ items: z.array(msg), nextCursor: z.string().nullable() }), 404: null },
  }),
  async (req, res) => {
    const c = await findConversation((req.params as z.infer<typeof idParams>).id, req.user!, true);
    const { cursor, limit } = req.query as unknown as z.infer<typeof pageQuery>;
    // Audit every open, not just the first page: a later page is still a read of the thread.
    await audit(req.user!, { action: 'conversation.read', targetType: 'Conversation', targetId: c.id, after: { between: [c.from.name, c.to.name], page: cursor ? 'next' : 'first', note: `Read conversation ${c.id}` } });
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

export default router;
