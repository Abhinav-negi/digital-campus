import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../../lib/audit.js';
import type { AuthUser } from '../../lib/auth.js';
import { classAccess } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { HttpError, page, pageQuery, paginate } from '../../lib/http.js';
import { notify } from '../../lib/notify.js';
import { registry, route } from '../../lib/openapi.js';
import { ownKey, presignGet } from '../../lib/storage.js';
import { activeTerm, classAudience, writable } from './service.js';

// CS-07: the class board (SPEC §7.1) + its edit history (the class's AuditLog). Mounted at /classes/:id.

/** A key from `POST /files/presign` by this user (`uploads/<userId>/<uuid>-<name>.<ext>`): no one attaches someone else's upload. */

const idParams = z.object({ id: z.string().min(1) });
const itemParams = idParams.extend({ itemId: z.string().min(1) });
const person = z.object({ id: z.string(), name: z.string() });
const kinds = ['notice', 'syllabus', 'exam', 'deadline', 'file'] as const;
type Kind = (typeof kinds)[number];
const iso = (d: Date) => d.toISOString().slice(0, 10);

const boardItem = z
  .object({
    id: z.string(),
    kind: z.enum(kinds),
    termId: z.string().nullable(),
    title: z.string(),
    body: z.string().nullable(),
    subject: z.object({ id: z.string(), name: z.string() }).nullable(),
    units: z.array(z.string()),
    date: z.string().nullable(),
    pinned: z.boolean(),
    fileName: z.string().nullable(),
    /** Short-lived download link (presignGet) when the item has a file. */
    fileUrl: z.string().nullable(),
    author: person,
    updatedAt: z.string(),
  })
  .meta({ id: 'BoardItem' });

const fields = {
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(5000).nullable().optional(),
  subjectId: z.string().min(1).nullable().optional(),
  date: z.iso.date().nullable().optional(),
  pinned: z.boolean().optional(),
  units: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
  /** The `key` from POST /files/presign. */
  fileKey: z.string().min(1).nullable().optional(),
  fileName: z.string().trim().min(1).max(200).nullable().optional(),
};
const createBody = z.object({ kind: z.enum(kinds), ...fields });
const patchBody = z.object({ ...fields, title: fields.title.optional() });
type Fields = Omit<z.infer<typeof createBody>, 'kind'>;

const include = { subject: { select: { id: true, name: true } }, author: { select: { id: true, name: true } } } satisfies Prisma.BoardItemInclude;
type Row = Prisma.BoardItemGetPayload<{ include: typeof include }>;

const present = async (b: Row) => ({
  id: b.id,
  kind: b.kind,
  termId: b.termId,
  title: b.title,
  body: b.body,
  subject: b.subject,
  units: b.units,
  date: b.date && iso(b.date),
  pinned: b.pinned,
  fileName: b.fileName,
  fileUrl: b.fileKey ? await presignGet(b.fileKey) : null,
  author: b.author,
  updatedAt: b.updatedAt,
});

type Item = { kind: Kind; title: string; body: string | null; subjectId: string | null; date: Date | null; pinned: boolean; units: string[]; fileKey: string | null; fileName: string | null };
const snapshot = ({ kind, title, body, subjectId, date, pinned, units, fileKey, fileName }: Item) => ({
  kind,
  title,
  body,
  subjectId,
  date: date && iso(date),
  pinned,
  units,
  fileKey,
  fileName,
});

/** Validate a board item's final state; `prevKey` is the stored key (re-sending it is fine even if someone else uploaded it). */
const check = async (tx: Prisma.TransactionClient, classId: string, user: AuthUser, b: Item, prevKey: string | null = null) => {
  const bad = (msg: string) => new HttpError(422, 'VALIDATION', msg);
  if ((b.kind === 'exam' || b.kind === 'deadline') && !b.date) throw bad(`An ${b.kind} needs a date`);
  if (b.kind === 'file' && !b.fileKey) throw bad('A file item needs a file');
  if (b.kind === 'syllabus' && !b.subjectId) throw bad('A syllabus needs a subject');
  if (b.fileKey && b.fileKey !== prevKey && !ownKey(user.id, b.fileKey)) throw bad('Upload the file first (POST /files/presign)');
  if (b.subjectId && !(await tx.subject.count({ where: { id: b.subjectId, classId, term: { endedAt: null } } }))) throw bad('Subject not found in this class');
};

const fromBody = (kind: Kind, f: Fields): Item => ({
  kind,
  title: f.title,
  body: f.body || null,
  subjectId: f.subjectId ?? null,
  date: f.date ? new Date(f.date) : null,
  pinned: kind === 'notice' && !!f.pinned,
  units: f.units ?? [],
  fileKey: f.fileKey ?? null,
  fileName: f.fileKey ? (f.fileName ?? f.fileKey.split('/').pop()!) : null,
});

/** Create + audit; a new exam or deadline tells the class (not the author). Reused by from-post. */
const create = async (tx: Prisma.TransactionClient, user: AuthUser, classId: string, b: Item, extra: Record<string, string> = {}) => {
  await check(tx, classId, user, b);
  // Notices and files persist across terms (termId null); the rest belong to the active term.
  const termId = b.kind === 'notice' || b.kind === 'file' ? null : (await activeTerm(classId, tx)).id;
  const row = await tx.boardItem.create({ data: { ...b, classId, termId, authorId: user.id }, include });
  await audit(user, { action: `board.${b.kind}.create`, classId, targetType: 'BoardItem', targetId: row.id, after: { ...snapshot(b), ...extra } }, tx);
  if (b.kind === 'exam' || b.kind === 'deadline') {
    const to = (await classAudience(classId, tx)).filter((id) => id !== user.id);
    await notify(to, 'board-item', { text: `New ${b.kind}: ${b.title} (${iso(b.date!)})`, classId, itemId: row.id, kind: b.kind, date: iso(b.date!) }, tx);
  }
  return row;
};

/** The item in this class, or 404; a past term's item is read-only → 409. */
const editable = async (tx: Prisma.TransactionClient, classId: string, itemId: string) => {
  const b = await tx.boardItem.findFirst({ where: { id: itemId, classId }, include: { term: { select: { endedAt: true } } } });
  if (!b) throw new HttpError(404, 'NOT_FOUND', 'Board item not found');
  if (b.term?.endedAt) throw new HttpError(409, 'PAST_TERM', "A past term's board is read-only");
  return b;
};

const router = Router({ mergeParams: true });

router.get(
  '/board',
  classAccess('id', 'read'),
  route(registry, {
    method: 'get',
    path: '/classes/:id/board',
    summary: "The class board for a term (default: the latest); notices and files carry across terms. Empty sections are []",
    guard: 'classAccess',
    request: { params: idParams, query: z.object({ termId: z.string().min(1).optional() }) },
    responses: {
      200: z.object({ notices: z.array(boardItem), exams: z.array(boardItem), deadlines: z.array(boardItem), syllabus: z.array(boardItem), files: z.array(boardItem) }).meta({ id: 'Board' }),
    },
  }),
  async (req, res) => {
    const classId = String(req.params.id);
    const termId = (req.query as { termId?: string }).termId ?? (await db.term.findFirst({ where: { classId }, orderBy: { semester: 'desc' } }))?.id;
    const rows = await db.boardItem.findMany({
      where: { classId, OR: [{ termId: null }, ...(termId ? [{ termId }] : [])] },
      include,
      // Pinned notices first, dated items soonest first, then newest.
      orderBy: [{ pinned: 'desc' }, { date: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'asc' }],
    });
    const items = await Promise.all(rows.map(present));
    const of = (k: Kind) => items.filter((b) => b.kind === k);
    res.json({ notices: of('notice'), exams: of('exam'), deadlines: of('deadline'), syllabus: of('syllabus'), files: of('file') });
  },
);

router.post(
  '/board',
  classAccess('id', 'board'),
  writable,
  route(registry, {
    method: 'post',
    path: '/classes/:id/board',
    summary: 'Add a board item (CR, class teacher, admin); exams and deadlines need a date, files a fileKey, syllabus a subject',
    guard: 'classAccess',
    request: { params: idParams, body: createBody },
    responses: { 201: boardItem, 409: null },
  }),
  async (req, res) => {
    const classId = String(req.params.id);
    const { kind, ...f } = req.body as z.infer<typeof createBody>;
    const row = await db.$transaction((tx) => create(tx, req.user!, classId, fromBody(kind, f)));
    res.status(201).json(await present(row));
  },
);

router.post(
  '/board/from-post',
  classAccess('id', 'board'),
  writable,
  route(registry, {
    method: 'post',
    path: '/classes/:id/board/from-post',
    summary: "Turn a teacher's post to this class into an exam or deadline (the post's text becomes the note)",
    guard: 'classAccess',
    request: {
      params: idParams,
      body: z.object({ postId: z.string().min(1), kind: z.enum(['exam', 'deadline']), title: fields.title, date: z.iso.date(), subjectId: z.string().min(1).optional() }),
    },
    responses: { 201: boardItem, 404: null, 409: null },
  }),
  async (req, res) => {
    const classId = String(req.params.id);
    const { postId, ...f } = req.body as { postId: string; kind: 'exam' | 'deadline'; title: string; date: string; subjectId?: string };
    const target = await db.postTarget.findUnique({ where: { postId_classId: { postId, classId } }, include: { post: { select: { body: true } } } });
    if (!target) throw new HttpError(404, 'NOT_FOUND', 'Post not found in this class');
    const row = await db.$transaction((tx) => create(tx, req.user!, classId, fromBody(f.kind, { ...f, body: target.post.body }), { fromPostId: postId }));
    res.status(201).json(await present(row));
  },
);

router.patch(
  '/board/:itemId',
  classAccess('id', 'board'),
  writable,
  route(registry, {
    method: 'patch',
    path: '/classes/:id/board/:itemId',
    summary: 'Edit a board item (audited with before/after); null clears a field',
    guard: 'classAccess',
    request: { params: itemParams, body: patchBody },
    responses: { 200: boardItem, 404: null, 409: null },
  }),
  async (req, res) => {
    const { id: classId, itemId } = req.params as { id: string; itemId: string };
    const f = req.body as z.infer<typeof patchBody>;
    const row = await db.$transaction(async (tx) => {
      const before = await editable(tx, classId, itemId);
      const keep = <T>(v: T | undefined, old: T) => (v === undefined ? old : v);
      const fileKey = keep(f.fileKey, before.fileKey);
      const next: Item = {
        kind: before.kind,
        title: f.title ?? before.title,
        body: f.body === undefined ? before.body : f.body || null,
        subjectId: keep(f.subjectId, before.subjectId),
        date: f.date === undefined ? before.date : f.date ? new Date(f.date) : null,
        pinned: before.kind === 'notice' && keep(f.pinned, before.pinned),
        units: f.units ?? before.units,
        fileKey,
        fileName: !fileKey ? null : (keep(f.fileName, fileKey === before.fileKey ? before.fileName : null) ?? fileKey.split('/').pop()!),
      };
      await check(tx, classId, req.user!, next, before.fileKey);
      const after = await tx.boardItem.update({ where: { id: itemId }, data: next, include });
      await audit(req.user!, { action: `board.${before.kind}.update`, classId, targetType: 'BoardItem', targetId: itemId, before: snapshot(before), after: snapshot(next) }, tx);
      return after;
    });
    res.json(await present(row));
  },
);

router.delete(
  '/board/:itemId',
  classAccess('id', 'board'),
  writable,
  route(registry, {
    method: 'delete',
    path: '/classes/:id/board/:itemId',
    summary: 'Delete a board item (audited)',
    guard: 'classAccess',
    request: { params: itemParams },
    responses: { 204: null, 404: null, 409: null },
  }),
  async (req, res) => {
    const { id: classId, itemId } = req.params as { id: string; itemId: string };
    await db.$transaction(async (tx) => {
      const b = await editable(tx, classId, itemId);
      await tx.boardItem.delete({ where: { id: itemId } });
      await audit(req.user!, { action: `board.${b.kind}.delete`, classId, targetType: 'BoardItem', targetId: itemId, before: snapshot(b) }, tx);
    });
    // ponytail: the stored file (if any) stays on disk; sweep unreferenced uploads in a job if storage matters.
    res.status(204).end();
  },
);

const historyRow = z
  .object({
    id: z.string(),
    action: z.string(),
    targetType: z.string(),
    targetId: z.string(),
    before: z.unknown().nullable(),
    after: z.unknown().nullable(),
    actor: person,
    createdAt: z.string(),
  })
  .meta({ id: 'HistoryEntry' });

router.get(
  '/history',
  classAccess('id', 'board'),
  route(registry, {
    method: 'get',
    path: '/classes/:id/history',
    summary: "The board's edit log, newest first (CR, class teacher, admin); ?targetId= = one board item's history (deleted ones too)",
    guard: 'classAccess',
    request: { params: idParams, query: pageQuery.extend({ targetId: z.string().min(1).optional() }) },
    responses: { 200: z.object({ items: z.array(historyRow), nextCursor: z.string().nullable() }), 404: null },
  }),
  async (req, res) => {
    const { cursor, limit, targetId } = req.query as unknown as { cursor?: string; limit: number; targetId?: string };
    const rows = await db.auditLog.findMany({
      // Board rows only: the class log also holds roster/CR/admin rows (emails, ID numbers) that aren't the board's to show.
      where: { classId: String(req.params.id), targetType: 'BoardItem', action: { startsWith: 'board.' }, targetId },
      select: { id: true, action: true, targetType: true, targetId: true, before: true, after: true, createdAt: true, actor: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...paginate(cursor, limit),
    });
    // A targetId with no board history here (another class's item, a user, a subject…) is a 404, not an empty page.
    if (targetId && !cursor && !rows.length) throw new HttpError(404, 'NOT_FOUND', 'Board item not found');
    res.json(page(rows, limit));
  },
);

export default router;
