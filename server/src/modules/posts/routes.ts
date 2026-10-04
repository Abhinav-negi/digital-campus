import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../../lib/audit.js';
import type { AuthUser } from '../../lib/auth.js';
import { auth, classAccess, staff } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { HttpError, notFound, page, pageQuery, paginate } from '../../lib/http.js';
import { notify } from '../../lib/notify.js';
import { registry, route } from '../../lib/openapi.js';
import { presignGet } from '../../lib/storage.js';
import { ownKey } from '../../lib/storage.js';

// CS-08: teacher posts (SPEC §7.2). app.ts mounts this at both /posts and /classes/:id/posts; a class id picks the class router.

const person = z.object({ id: z.string(), name: z.string() });
const seenStats = z.object({ seen: z.number().int(), total: z.number().int() });
const post = z
  .object({
    id: z.string(),
    kind: z.enum(['announcement', 'assignment']),
    title: z.string(),
    body: z.string(),
    dueAt: z.string().nullable(),
    fileName: z.string().nullable(),
    fileUrl: z.string().nullable(),
    author: person,
    classes: z.array(person),
    createdAt: z.string(),
    /** Students: whether I've seen it. Null for staff. */
    seen: z.boolean().nullable(),
    /** Staff/admin: students who've seen it, in this class (class list) or across every target (/posts/mine). */
    stats: seenStats.nullable(),
  })
  .meta({ id: 'Post' });
const list = z.object({ items: z.array(post), nextCursor: z.string().nullable() });
const idParams = z.object({ id: z.string().min(1) });

const include = { author: { select: { id: true, name: true } }, targets: { select: { class: { select: { id: true, name: true } } } } } satisfies Prisma.PostInclude;
type Row = Prisma.PostGetPayload<{ include: typeof include }>;

const present = async (p: Row, extra: { seen?: boolean; stats?: z.infer<typeof seenStats> }) => ({
  id: p.id,
  kind: p.kind,
  title: p.title,
  body: p.body,
  dueAt: p.dueAt,
  fileName: p.fileName,
  fileUrl: p.fileKey ? await presignGet(p.fileKey) : null,
  author: p.author,
  classes: p.targets.map((t) => t.class),
  createdAt: p.createdAt,
  seen: extra.seen ?? null,
  stats: extra.stats ?? null,
});

/** Active students (and CRs) of any of these classes. */
const studentsOf = (classIds: string[]) =>
  ({ role: 'student', status: 'active', memberships: { some: { classId: { in: classIds }, role: { in: ['student', 'cr'] } } } }) satisfies Prisma.UserWhereInput;

// ponytail: two counts per post on a page (≤100 posts); one grouped SQL query if lists get slow.
const stats = async (postId: string, classIds: string[]) => {
  const [seen, total] = await Promise.all([db.postSeen.count({ where: { postId, user: studentsOf(classIds) } }), db.user.count({ where: studentsOf(classIds) })]);
  return { seen, total };
};

/** One audit row per target class, so the post shows in each class's history. */
const auditTargets = (tx: Prisma.TransactionClient, user: AuthUser, action: string, postId: string, classIds: string[], after: Prisma.InputJsonValue) =>
  Promise.all(classIds.map((classId) => audit(user, { action, classId, targetType: 'Post', targetId: postId, after }, tx)));

// --- /posts ---
const posts = Router();

const createBody = z.object({
  kind: z.enum(['announcement', 'assignment']),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
  classIds: z.array(z.string().min(1)).min(1).max(20),
  /** Required for an assignment (it feeds Upcoming); ignored for an announcement. */
  dueAt: z.iso.datetime({ offset: true }).or(z.iso.date()).optional(),
  /** The `key` from POST /files/presign. */
  fileKey: z.string().min(1).optional(),
  fileName: z.string().trim().min(1).max(200).optional(),
});

posts.post(
  '/',
  staff(),
  route(registry, {
    method: 'post',
    path: '/posts',
    summary: 'Post to one or more classes (you must teach in every one, or be an admin); their students are notified',
    guard: 'auth',
    request: { body: createBody },
    responses: { 201: post, 403: null, 404: null, 409: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const b = req.body as z.infer<typeof createBody>;
    if (b.kind === 'assignment' && !b.dueAt) throw new HttpError(422, 'VALIDATION', 'An assignment needs a due date');
    if (b.fileKey && !ownKey(me.id, b.fileKey)) throw new HttpError(422, 'VALIDATION', 'Upload the file first (POST /files/presign)');
    const classIds = [...new Set(b.classIds)];
    const classes = await db.class.findMany({
      where: { id: { in: classIds } },
      select: { id: true, name: true, archivedAt: true, classTeacherId: true, subjects: { where: { teacherId: me.id, term: { endedAt: null } }, select: { id: true }, take: 1 } },
    });
    if (classes.length !== classIds.length) throw new HttpError(404, 'NOT_FOUND', 'Class not found');
    if (!me.isAdmin)
      for (const c of classes) {
        // Same rule as classAccess 'teach': class teacher, or teaches an active-term subject.
        if (c.classTeacherId !== me.id && !c.subjects.length) throw new HttpError(403, 'FORBIDDEN', `You don't teach ${c.name}`);
        if (c.archivedAt) throw new HttpError(409, 'ARCHIVED', `${c.name} is archived and read-only`);
      }
    const row = await db.$transaction(async (tx) => {
      const p = await tx.post.create({
        data: {
          authorId: me.id,
          kind: b.kind,
          title: b.title,
          body: b.body,
          dueAt: b.kind === 'assignment' ? new Date(b.dueAt!) : null,
          fileKey: b.fileKey ?? null,
          fileName: b.fileKey ? (b.fileName ?? b.fileKey.split('/').pop()!) : null,
          targets: { create: classIds.map((classId) => ({ classId })) },
        },
        include,
      });
      await auditTargets(tx, me, 'post.create', p.id, classIds, { kind: p.kind, title: p.title, classIds });
      const to = await tx.user.findMany({ where: studentsOf(classIds), select: { id: true } });
      const what = p.kind === 'assignment' ? 'an assignment' : 'an announcement';
      await notify(to.map((u) => u.id), 'post', { text: `${me.name} posted ${what}: ${p.title}`, postId: p.id }, tx);
      return p;
    });
    res.status(201).json(await present(row, { stats: { seen: 0, total: await db.user.count({ where: studentsOf(classIds) }) } }));
  },
);

posts.get(
  '/mine',
  staff(),
  route(registry, {
    method: 'get',
    path: '/posts/mine',
    summary: 'My posts, newest first, with seen counts across all their classes',
    guard: 'auth',
    request: { query: pageQuery },
    responses: { 200: list },
  }),
  async (req, res) => {
    const { cursor, limit } = req.query as unknown as { cursor?: string; limit: number };
    const rows = await db.post.findMany({ where: { authorId: req.user!.id }, include, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...paginate(cursor, limit) });
    const items = await Promise.all(rows.map(async (p) => present(p, { stats: await stats(p.id, p.targets.map((t) => t.class.id)) })));
    res.json(page(items, limit));
  },
);

posts.post(
  '/:id/seen',
  auth(),
  route(registry, {
    method: 'post',
    path: '/posts/:id/seen',
    summary: 'Mark a post seen (students; idempotent)',
    guard: 'auth',
    request: { params: idParams },
    responses: { 204: null, 403: null, 404: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const postId = String(req.params.id);
    if (me.role !== 'student') throw new HttpError(403, 'FORBIDDEN', 'Only students mark posts seen');
    const mine = await db.post.count({ where: { id: postId, targets: { some: { class: { members: { some: { userId: me.id } } } } } } });
    if (!mine) throw new HttpError(404, 'NOT_FOUND', 'Post not found');
    // Read receipt, not a class edit: no audit row.
    await db.postSeen.createMany({ data: [{ postId, userId: me.id }], skipDuplicates: true });
    res.status(204).end();
  },
);

posts.post(
  '/:id/remind',
  auth(),
  route(registry, {
    method: 'post',
    path: '/posts/:id/remind',
    summary: "Remind the students who haven't seen it (the author or an admin)",
    guard: 'auth',
    request: { params: idParams },
    responses: { 200: z.object({ reminded: z.number().int() }), 403: null, 404: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const postId = String(req.params.id);
    const p = await db.post.findUnique({ where: { id: postId }, select: { authorId: true, title: true, targets: { select: { classId: true } } } });
    if (!p) throw new HttpError(404, 'NOT_FOUND', 'Post not found');
    if (p.authorId !== me.id && !me.isAdmin) throw new HttpError(403, 'FORBIDDEN', 'Only the author can send a reminder');
    const classIds = p.targets.map((t) => t.classId);
    const reminded = await db.$transaction(async (tx) => {
      const unseen = await tx.user.findMany({ where: { ...studentsOf(classIds), postsSeen: { none: { postId } } }, select: { id: true } });
      const { count } = await notify(unseen.map((u) => u.id), 'post', { text: `Reminder from ${me.name}: ${p.title}`, postId }, tx);
      await auditTargets(tx, me, 'post.remind', postId, classIds, { reminded: count });
      return count;
    });
    res.json({ reminded });
  },
);

// --- /classes/:id/posts ---
const classPosts = Router({ mergeParams: true });

classPosts.get(
  '/',
  classAccess('id', 'read'),
  route(registry, {
    method: 'get',
    path: '/classes/:id/posts',
    summary: "Teacher posts to this class, newest first; students get `seen`, staff get this class's `stats`",
    guard: 'classAccess',
    request: { params: idParams, query: pageQuery },
    responses: { 200: list },
  }),
  async (req, res) => {
    const me = req.user!;
    const classId = String(req.params.id);
    const { cursor, limit } = req.query as unknown as { cursor?: string; limit: number };
    const rows = await db.post.findMany({
      where: { targets: { some: { classId } } },
      include: { ...include, seen: { where: { userId: me.id }, select: { id: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...paginate(cursor, limit),
    });
    const student = me.role === 'student';
    const items = await Promise.all(rows.map(async (p) => present(p, student ? { seen: p.seen.length > 0 } : { stats: await stats(p.id, [classId]) })));
    res.json(page(items, limit));
  },
);

// Otherwise /classes/:id/posts/* would fall through to the classes router's 501 stub.
classPosts.use(notFound);

const router = Router({ mergeParams: true });
router.use((req, res, next) => (req.params.id ? classPosts : posts)(req, res, next));
export default router;
