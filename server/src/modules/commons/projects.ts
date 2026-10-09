import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../../lib/auth.js';
import { today } from '../../lib/dates.js';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { notify } from '../../lib/notify.js';
import { blockedEitherWay, unblocked } from './safety.js';
import { registry, route } from '../../lib/openapi.js';
import { boardPostDetail, studentOnly } from './board.js';
import { personCard, personSelect, toCard, viewerOf } from './profiles.js';

// CM-04: projects, join requests, the contribution log (SPEC §9.3; PROTO student.html:356-404, :600-611).
// `featured`, `community` and `flagship` are admin-only (AD-07). No email is ever selected (personSelect has none).

const STATUS = ['looking', 'building', 'shipped'] as const;

// --- schemas ---
/** The board's Byline component (board.ts doesn't export it by name). */
export const byline = boardPostDetail.shape.author;
const member = personCard.pick({ id: true, name: true, branch: true, label: true, otherBranch: true }).extend({ role: z.string() }).meta({ id: 'ProjectMember' });

const projectCard = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    roles: z.array(z.string()),
    /** http(s) for new data; old seed rows may lack the scheme, so the client must check before linking. */
    repoUrl: z.string().nullable(),
    status: z.enum(STATUS),
    featured: z.boolean(),
    /** Only in an admin's `includeHidden` list, on hidden items. */
    hiddenAt: z.iso.datetime().optional(),
    community: z.boolean(),
    flagship: z.boolean(),
    /** Members' branch codes, distinct. */
    branches: z.array(z.string()),
    /** Members from 2 or more branches. */
    crossBranch: z.boolean(),
    /** The owner first. */
    members: z.array(member),
    me: z.enum(['member', 'requested', 'none']),
    createdAt: z.string(),
  })
  .meta({ id: 'ProjectCard' });

export const projectDetail = projectCard
  .extend({
    owner: byline,
    mine: z.boolean(),
    /** Newest first; source github arrives later (SPEC §14). */
    updates: z.array(z.object({ id: z.string(), body: z.string(), source: z.enum(['manual', 'github']), createdAt: z.string(), author: byline })),
    /** Pending requests: the owner sees them all, anyone else an empty list. */
    requests: z.array(z.object({ id: z.string(), note: z.string().nullable(), createdAt: z.string(), user: byline })),
  })
  .meta({ id: 'ProjectDetail' });

// --- reads ---
export type Viewer = { branchId: string | null; on: Date };
type PersonRow = Parameters<typeof toCard>[0];
export const by = (u: PersonRow, v: Viewer) => {
  const { id, name, label, otherBranch } = toCard(u, v.branchId, v.on);
  return { id, name, label, otherBranch };
};

const cardInclude = (meId: string) =>
  ({
    members: { include: { user: { select: personSelect } }, orderBy: { createdAt: 'asc' } },
    joinRequests: { where: { userId: meId, state: 'pending' }, select: { id: true } },
  }) satisfies Prisma.ProjectInclude;
type CardRow = Prisma.ProjectGetPayload<{ include: ReturnType<typeof cardInclude> }>;

const toProjectCard = (p: CardRow, meId: string, v: Viewer): z.infer<typeof projectCard> => {
  const members = [...p.members]
    .sort((a, b) => +(b.userId === p.ownerId) - +(a.userId === p.ownerId))
    .map((m) => {
      const { id, name, branch, label, otherBranch } = toCard(m.user, v.branchId, v.on);
      return { id, name, branch, label, otherBranch, role: m.role };
    });
  const branches = [...new Set(members.flatMap((m) => (m.branch ? [m.branch.code] : [])))];
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    roles: p.roles,
    repoUrl: p.repoUrl,
    status: p.status,
    featured: p.featured,
    community: p.community,
    flagship: p.flagship,
    branches,
    crossBranch: branches.length >= 2,
    members,
    me: p.members.some((m) => m.userId === meId) ? 'member' : p.joinRequests.length ? 'requested' : 'none',
    createdAt: p.createdAt.toISOString(),
  };
};

export const viewer = async (me: AuthUser) => {
  const u = await viewerOf(me.id);
  return { institutionId: u.institutionId, v: { branchId: u.homeClass?.branchId ?? null, on: today() } };
};

/** A project in my institution; a hidden one only for its owner and admins. 404 otherwise. */
const findProject = async (id: string, me: AuthUser) => {
  const [{ institutionId, v }, p] = await Promise.all([
    viewer(me),
    db.project.findUnique({
      where: { id },
      include: {
        ...cardInclude(me.id),
        owner: { select: { ...personSelect, institutionId: true } },
        updates: { include: { author: { select: personSelect } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
        // The owner reads every pending request; for anyone else the list is cut in projectView.
        joinRequests: { where: { state: 'pending' }, include: { user: { select: personSelect } }, orderBy: { createdAt: 'asc' } },
      },
    }),
  ]);
  if (!p || p.owner.institutionId !== institutionId || (p.hiddenAt && p.ownerId !== me.id && !me.isAdmin))
    throw new HttpError(404, 'NOT_FOUND', 'Project not found');
  if (p.ownerId !== me.id && (await blockedEitherWay(me.id, p.ownerId))) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
  return { p, v };
};

const projectView = async (id: string, me: AuthUser): Promise<z.infer<typeof projectDetail>> => {
  const { p, v } = await findProject(id, me);
  const mine = p.ownerId === me.id;
  return {
    ...toProjectCard({ ...p, joinRequests: p.joinRequests.filter((r) => r.userId === me.id) }, me.id, v),
    owner: by(p.owner, v),
    mine,
    updates: p.updates.map((u) => ({ id: u.id, body: u.body, source: u.source, createdAt: u.createdAt.toISOString(), author: by(u.author, v) })),
    requests: mine ? p.joinRequests.map((r) => ({ id: r.id, note: r.note, createdAt: r.createdAt.toISOString(), user: by(r.user, v) })) : [],
  };
};

const ownerOnly = (p: { ownerId: string }, me: AuthUser) => {
  if (p.ownerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the project owner can do that');
};

// --- routes ---
const router = Router();
const idParams = z.object({ id: z.string().min(1) });
type Id = z.infer<typeof idParams>;

router.get(
  '/projects',
  route(registry, {
    method: 'get',
    path: '/commons/projects',
    summary: "Build: this semester's flagship, the featured and community strip (featured first), then every other project; hidden ones left out",
    guard: 'commons',
    request: { query: z.object({ includeHidden: z.enum(['1', 'true']).optional() }) },
    responses: { 200: z.object({ flagship: projectCard.nullable(), featured: z.array(projectCard), all: z.array(projectCard) }) },
  }),
  async (req, res) => {
    const me = req.user!;
    const { institutionId, v } = await viewer(me);
    const withHidden = !!(req.query as { includeHidden?: string }).includeHidden && me.isAdmin; // the wall: students' includeHidden is ignored
    // ponytail: every visible project in one read, no paging; one school's projects are a few hundred at most.
    const rows = await db.project.findMany({
      where: { ...(!withHidden && { hiddenAt: null }), owner: { institutionId } },
      include: cardInclude(me.id),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const cards = rows.map((p) => ({ ...toProjectCard(p, me.id, v), ...(withHidden && p.hiddenAt && { hiddenAt: p.hiddenAt.toISOString() }) }));
    const flagship = cards.find((p) => p.flagship) ?? null;
    const rest = cards.filter((p) => p !== flagship);
    res.json({
      flagship,
      featured: rest.filter((p) => p.featured || p.community).sort((a, b) => +b.featured - +a.featured),
      all: rest.filter((p) => !(p.featured || p.community)),
    });
  },
);

const title = z.string().trim().min(1).max(140);
const description = z.string().trim().min(1).max(2000);
const roles = z.array(z.string().trim().min(1).max(40)).max(10);
// Rendered as a link: http(s) only, never javascript: or data: (CM-01 security note).
const repoUrl = z.url({ protocol: /^https?$/ }).trim().max(200);
const createBody = z
  .object({ title, description, roles: roles.default([]), repoUrl: repoUrl.optional(), status: z.enum(STATUS).default('looking') })
  .meta({ id: 'ProjectCreate' });

router.post(
  '/projects',
  route(registry, {
    method: 'post',
    path: '/commons/projects',
    summary: 'Post a project (students); I join it as its owner',
    guard: 'commons',
    request: { body: createBody },
    responses: { 201: projectDetail, 403: null },
  }),
  async (req, res) => {
    const me = req.user!;
    studentOnly(me);
    const { roles: r, ...input } = req.body as z.infer<typeof createBody>;
    const p = await db.project.create({
      data: { ...input, roles: [...new Set(r)], ownerId: me.id, members: { create: { userId: me.id, role: 'Owner' } } },
    });
    res.status(201).json(await projectView(p.id, me));
  },
);

router.get(
  '/projects/:id',
  route(registry, {
    method: 'get',
    path: '/commons/projects/:id',
    summary: 'A project with its team, contribution log, my state, and (owner only) the pending join requests',
    guard: 'commons',
    request: { params: idParams },
    responses: { 200: projectDetail, 404: null },
  }),
  async (req, res) => {
    res.json(await projectView((req.params as Id).id, req.user!));
  },
);

const patchBody = z
  .object({ title, description, roles, /** null clears it */ repoUrl: repoUrl.nullable(), status: z.enum(STATUS) })
  .partial()
  .meta({ id: 'ProjectPatch' });

router.patch(
  '/projects/:id',
  route(registry, {
    method: 'patch',
    path: '/commons/projects/:id',
    summary: 'Edit my project; only sent fields change (featured/flagship are admin-only, AD-07)',
    guard: 'commons',
    request: { params: idParams, body: patchBody },
    responses: { 200: projectDetail, 403: null, 404: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const { id } = req.params as Id;
    ownerOnly((await findProject(id, me)).p, me);
    const { roles: r, ...data } = req.body as z.infer<typeof patchBody>;
    await db.project.update({ where: { id }, data: { ...data, ...(r && { roles: [...new Set(r)] }) } });
    res.json(await projectView(id, me));
  },
);

router.delete(
  '/projects/:id',
  route(registry, {
    method: 'delete',
    path: '/commons/projects/:id',
    summary: 'Delete my project (its team, join requests and log go with it)',
    guard: 'commons',
    request: { params: idParams },
    responses: { 204: null, 403: null, 404: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const { id } = req.params as Id;
    ownerOnly((await findProject(id, me)).p, me);
    await db.project.delete({ where: { id } });
    res.status(204).end();
  },
);

const joinBody = z.object({ note: z.string().trim().max(300).optional() });

router.post(
  '/projects/:id/join',
  route(registry, {
    method: 'post',
    path: '/commons/projects/:id/join',
    summary: 'Ask to join a project, with an optional note (one pending request at a time); the owner is notified',
    guard: 'commons',
    request: { params: idParams, body: joinBody },
    responses: { 201: projectDetail, 403: null, 404: null, 409: null },
  }),
  async (req, res) => {
    const me = req.user!;
    studentOnly(me);
    const { p } = await findProject((req.params as Id).id, me);
    if (p.members.some((m) => m.userId === me.id)) throw new HttpError(409, 'CONFLICT', 'You are already on the team');
    // ponytail: check-then-insert (no unique index for "one pending per user"), so a double tap can leave two
    // pending rows; accepting one then 409s the other on ProjectMember's unique index. A partial unique index fixes it.
    if (p.joinRequests.some((r) => r.userId === me.id)) throw new HttpError(409, 'CONFLICT', 'You already asked to join');
    await db.$transaction(async (tx) => {
      await tx.joinRequest.create({ data: { projectId: p.id, userId: me.id, note: (req.body as z.infer<typeof joinBody>).note || null } });
      await notify([p.ownerId], 'project-join', { text: `${me.name} asked to join ${p.title}`, projectId: p.id }, tx);
    });
    res.status(201).json(await projectView(p.id, me));
  },
);

const replyBody = z.object({ state: z.enum(['accepted', 'declined']) });

router.post(
  '/join-requests/:id',
  route(registry, {
    method: 'post',
    path: '/commons/join-requests/:id',
    summary: 'The owner accepts (adds them to the team) or declines a pending join request; the requester is notified',
    guard: 'commons',
    request: { params: idParams, body: replyBody },
    responses: { 200: projectDetail, 403: null, 404: null, 409: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const { state } = req.body as z.infer<typeof replyBody>;
    const r = await db.joinRequest.findUnique({ where: { id: (req.params as Id).id } });
    if (!r) throw new HttpError(404, 'NOT_FOUND', 'Request not found');
    const { p } = await findProject(r.projectId, me);
    ownerOnly(p, me);
    await db.$transaction(async (tx) => {
      // Conditional update: a double tap (or accept + decline) can only settle a request once.
      const { count } = await tx.joinRequest.updateMany({ where: { id: r.id, state: 'pending' }, data: { state } });
      if (!count) throw new HttpError(409, 'CONFLICT', 'This request was already answered');
      if (state === 'accepted') await tx.projectMember.create({ data: { projectId: p.id, userId: r.userId, role: 'Member' } });
      const text = state === 'accepted' ? `You joined ${p.title}` : `Your request to join ${p.title} was declined`;
      await notify(await unblocked(me.id, [r.userId]), 'project-join-reply', { text, projectId: p.id }, tx);
    });
    res.json(await projectView(p.id, me));
  },
);

const updateBody = z.object({ body: z.string().trim().min(1).max(1000) });

router.post(
  '/projects/:id/updates',
  route(registry, {
    method: 'post',
    path: '/commons/projects/:id/updates',
    summary: 'Post a short update to the contribution log (team members)',
    guard: 'commons',
    request: { params: idParams, body: updateBody },
    responses: { 201: projectDetail, 403: null, 404: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const { p } = await findProject((req.params as Id).id, me);
    if (!p.members.some((m) => m.userId === me.id)) throw new HttpError(403, 'FORBIDDEN', 'Only team members can post updates');
    await db.projectUpdate.create({ data: { projectId: p.id, authorId: me.id, body: (req.body as z.infer<typeof updateBody>).body, source: 'manual' } });
    res.status(201).json(await projectView(p.id, me));
  },
);

export default router;
