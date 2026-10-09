import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';
import { HttpError } from '../../lib/http.js';
import { registry, route } from '../../lib/openapi.js';
import { viewerOf } from './profiles.js';

// CM-07: Block + Report with auto-hide (SPEC §12; PROTO student.html:340-344, :593).

/** Distinct open reports that hide a target until the admin reviews it (AD-06). */
const HIDE_AT = 3;

/** Everyone `userId` blocked or who blocked `userId`: the one rule for "hidden from each other". */
export const blockedIds = async (userId: string) => {
  const rows = await db.block.findMany({ where: { OR: [{ userId }, { blockedId: userId }] }, select: { userId: true, blockedId: true } });
  return rows.map((b) => (b.userId === userId ? b.blockedId : b.userId));
};
/** `ids` minus anyone blocked either way with `me`: who may still be notified of what `me` does. */
export const unblocked = async (me: string, ids: string[]) => {
  const hide = new Set(await blockedIds(me));
  return ids.filter((id) => !hide.has(id));
};
export const blockedEitherWay = async (a: string, b: string) => (await blockedIds(a)).includes(b);

const idParams = z.object({ userId: z.string().min(1) });
const blockItem = z.object({ userId: z.string(), name: z.string(), createdAt: z.iso.datetime() }).meta({ id: 'BlockItem' });

const router = Router();

router.get(
  '/blocks',
  route(registry, {
    method: 'get',
    path: '/commons/blocks',
    summary: 'People I have blocked, newest first',
    guard: 'commons',
    responses: { 200: z.object({ items: z.array(blockItem) }) },
  }),
  async (req, res) => {
    const rows = await db.block.findMany({ where: { userId: req.user!.id }, include: { blocked: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
    res.json({ items: rows.map((b) => ({ userId: b.blockedId, name: b.blocked.name, createdAt: b.createdAt.toISOString() })) });
  },
);

router.post(
  '/blocks',
  route(registry, {
    method: 'post',
    path: '/commons/blocks',
    summary: 'Block a person (idempotent): you stop seeing each other in people, the board and conversations',
    guard: 'commons',
    request: { body: z.object({ userId: z.string().min(1) }) },
    responses: { 201: blockItem, 404: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const { userId } = req.body as { userId: string };
    if (userId === me.id) throw new HttpError(422, 'VALIDATION', 'You cannot block yourself');
    const viewer = await viewerOf(me.id);
    const u = await db.user.findFirst({ where: { id: userId, institutionId: viewer.institutionId }, select: { name: true } });
    if (!u) throw new HttpError(404, 'NOT_FOUND', 'Person not found');
    const b = await db.block.upsert({ where: { userId_blockedId: { userId: me.id, blockedId: userId } }, update: {}, create: { userId: me.id, blockedId: userId } });
    res.status(201).json({ userId, name: u.name, createdAt: b.createdAt.toISOString() });
  },
);

router.delete(
  '/blocks/:userId',
  route(registry, {
    method: 'delete',
    path: '/commons/blocks/:userId',
    summary: 'Unblock a person (idempotent)',
    guard: 'commons',
    request: { params: idParams },
    responses: { 204: null },
  }),
  async (req, res) => {
    await db.block.deleteMany({ where: { userId: req.user!.id, blockedId: (req.params as z.infer<typeof idParams>).userId } });
    res.status(204).end();
  },
);

const REASONS = ['Spam', 'Unsafe or prohibited', 'Academic dishonesty', 'Harassment', 'Other'] as const;
const reportBody = z.object({
  targetType: z.enum(['board', 'project', 'challenge', 'message', 'profile']),
  targetId: z.string().min(1),
  reason: z.enum(REASONS),
});
type ReportBody = z.infer<typeof reportBody>;

/** The target as `me` may see it: its owner and (when it has one) its `hiddenAt` model; 404 if missing, hidden or elsewhere. */
const findTarget = async ({ targetType, targetId }: ReportBody, me: { id: string }) => {
  const { institutionId } = await viewerOf(me.id);
  const here = { institutionId };
  const notFound = new HttpError(404, 'NOT_FOUND', 'Nothing to report here');
  switch (targetType) {
    case 'board': {
      const p = await db.boardPost.findFirst({ where: { id: targetId, hiddenAt: null, author: here }, select: { authorId: true, kind: true } });
      if (!p) throw notFound;
      return { ownerId: p.authorId, gig: p.kind === 'gig' };
    }
    case 'project': {
      const p = await db.project.findFirst({ where: { id: targetId, hiddenAt: null, owner: here }, select: { ownerId: true } });
      if (!p) throw notFound;
      return { ownerId: p.ownerId, gig: false };
    }
    case 'challenge': {
      const c = await db.challenge.findFirst({ where: { id: targetId, hiddenAt: null, owner: here }, select: { ownerId: true } });
      if (!c) throw notFound;
      return { ownerId: c.ownerId, gig: false };
    }
    case 'message': {
      const m = await db.message.findFirst({
        where: { id: targetId, conversation: { OR: [{ fromId: me.id }, { toId: me.id }] } },
        select: { senderId: true },
      });
      if (!m) throw notFound;
      return { ownerId: m.senderId, gig: false };
    }
    case 'profile': {
      const u = await db.user.findFirst({ where: { id: targetId, role: 'student', status: 'active', ...here }, select: { id: true } });
      if (!u) throw notFound;
      return { ownerId: u.id, gig: false };
    }
  }
};

router.post(
  '/reports',
  route(registry, {
    method: 'post',
    path: '/commons/reports',
    summary: 'Report a post, project, challenge, message or profile (one per reporter per target); the 3rd distinct report hides posts, projects and challenges until an admin reviews them',
    guard: 'commons',
    request: { body: reportBody },
    responses: { 201: z.object({ id: z.string(), hidden: z.boolean() }), 404: null, 409: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const body = req.body as ReportBody;
    const { ownerId, gig } = await findTarget(body, me);
    if (ownerId === me.id) throw new HttpError(422, 'VALIDATION', 'You cannot report your own content');
    if (body.reason === 'Academic dishonesty' && !gig) throw new HttpError(422, 'VALIDATION', 'Academic dishonesty can only be reported on gigs');
    const { targetType, targetId, reason } = body;
    const out = await db.$transaction(async (tx) => {
      if (await tx.report.findFirst({ where: { reporterId: me.id, targetType, targetId } })) throw new HttpError(409, 'CONFLICT', 'You already reported this');
      const r = await tx.report.create({ data: { reporterId: me.id, targetType, targetId, reason } });
      const open = (await tx.report.findMany({ where: { targetType, targetId, state: 'open' }, distinct: ['reporterId'], select: { id: true } })).length;
      let hidden = false;
      if (open >= HIDE_AT && targetType !== 'message' && targetType !== 'profile') {
        const where = { id: targetId, hiddenAt: null };
        const data = { hiddenAt: new Date() };
        const { count } = await (targetType === 'board' ? tx.boardPost.updateMany({ where, data }) : targetType === 'project' ? tx.project.updateMany({ where, data }) : tx.challenge.updateMany({ where, data }));
        hidden = count > 0;
        // ponytail: AuditLog.actorId is a required User FK with no system user, so the triggering reporter is the actor and
        // `after.system` marks it automatic. A real system actor needs a schema/audit.ts change.
        if (hidden) await audit(me, { action: 'report.auto-hide', targetType, targetId, after: { system: true, hiddenBy: 'reports', reports: open } }, tx);
      }
      return { id: r.id, hidden };
    });
    res.status(201).json(out);
  },
);

export default router;
