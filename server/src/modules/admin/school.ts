import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../../lib/auth.js';
import { audit } from '../../lib/audit.js';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { registry, route } from '../../lib/openapi.js';

// AD-04: institution + branches (SPEC §5: branches are data). Mounted under /admin, behind admin().

/** The institution a user belongs to (one per deployment today, but scope by the actor anyway). */
export const institutionOf = async (userId: string) =>
  (await db.user.findUniqueOrThrow({ where: { id: userId }, select: { institutionId: true } })).institutionId;

const institution = z.object({ id: z.string(), name: z.string(), timezone: z.string() }).meta({ id: 'Institution' });
const branch = z.object({ id: z.string(), code: z.string(), name: z.string() }).meta({ id: 'Branch' });
const adminBranch = branch.extend({ classCount: z.number().int() }).meta({ id: 'AdminBranch' });

const timezone = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'Unknown time zone');
const branchBody = z.object({ code: z.string().trim().min(1).max(16).toUpperCase(), name: z.string().trim().min(1).max(120) });
const idParams = z.object({ id: z.string().min(1) });

const pickInst = ({ id, name, timezone }: z.infer<typeof institution>) => ({ id, name, timezone });
const pickBranch = ({ id, code, name }: z.infer<typeof branch>) => ({ id, code, name });

const router = Router();

router.get(
  '/institution',
  route(registry, { method: 'get', path: '/admin/institution', summary: 'The institution', guard: 'admin', responses: { 200: institution } }),
  async (req, res) => {
    res.json(pickInst(await db.institution.findUniqueOrThrow({ where: { id: await institutionOf(req.user!.id) } })));
  },
);

router.patch(
  '/institution',
  route(registry, {
    method: 'patch',
    path: '/admin/institution',
    summary: 'Rename the institution or change its time zone',
    guard: 'admin',
    request: { body: z.object({ name: z.string().trim().min(1).max(200).optional(), timezone: timezone.optional() }) },
    responses: { 200: institution },
  }),
  async (req, res) => {
    const id = await institutionOf(req.user!.id);
    const body = req.body as { name?: string; timezone?: string };
    const updated = await db.$transaction(async (tx) => {
      const before = await tx.institution.findUniqueOrThrow({ where: { id } });
      const after = await tx.institution.update({ where: { id }, data: body });
      await audit(req.user!, { action: 'institution.update', targetType: 'Institution', targetId: id, before: pickInst(before), after: pickInst(after) }, tx);
      return after;
    });
    res.json(pickInst(updated));
  },
);

router.get(
  '/branches',
  route(registry, {
    method: 'get',
    path: '/admin/branches',
    summary: 'Branches with how many classes use each',
    guard: 'admin',
    responses: { 200: z.object({ items: z.array(adminBranch) }) },
  }),
  async (req, res) => {
    const rows = await db.branch.findMany({
      where: { institutionId: await institutionOf(req.user!.id) },
      include: { _count: { select: { classes: true } } },
      orderBy: { code: 'asc' },
    });
    res.json({ items: rows.map((b) => ({ ...pickBranch(b), classCount: b._count.classes })) });
  },
);

const duplicateCode = (code: string) => new HttpError(409, 'BRANCH_EXISTS', `A branch with code ${code} already exists`);

router.post(
  '/branches',
  route(registry, {
    method: 'post',
    path: '/admin/branches',
    summary: 'Add a branch',
    guard: 'admin',
    request: { body: branchBody },
    responses: { 201: branch, 409: null },
  }),
  async (req, res) => {
    const institutionId = await institutionOf(req.user!.id);
    const body = req.body as z.infer<typeof branchBody>;
    if (await db.branch.findUnique({ where: { institutionId_code: { institutionId, code: body.code } } })) throw duplicateCode(body.code);
    const created = await db.$transaction(async (tx) => {
      const b = await tx.branch.create({ data: { institutionId, ...body } });
      await audit(req.user!, { action: 'branch.create', targetType: 'Branch', targetId: b.id, after: pickBranch(b) }, tx);
      return b;
    });
    res.status(201).json(pickBranch(created));
  },
);

/** A branch of the actor's institution, or 404. */
const findBranch = async (id: string, userId: string) => {
  const b = await db.branch.findFirst({ where: { id, institutionId: await institutionOf(userId) }, include: { _count: { select: { classes: true } } } });
  if (!b) throw new HttpError(404, 'NOT_FOUND', 'Branch not found');
  return b;
};

router.patch(
  '/branches/:id',
  route(registry, {
    method: 'patch',
    path: '/admin/branches/:id',
    summary: 'Rename a branch or change its code',
    guard: 'admin',
    request: { params: idParams, body: branchBody.partial() },
    responses: { 200: branch, 404: null, 409: null },
  }),
  async (req, res) => {
    const before = await findBranch(req.params.id as string, req.user!.id);
    const body = req.body as Partial<z.infer<typeof branchBody>>;
    if (body.code && body.code !== before.code && (await db.branch.findUnique({ where: { institutionId_code: { institutionId: before.institutionId, code: body.code } } })))
      throw duplicateCode(body.code);
    const after = await db.$transaction(async (tx) => {
      const b = await tx.branch.update({ where: { id: before.id }, data: body });
      await audit(req.user!, { action: 'branch.update', targetType: 'Branch', targetId: b.id, before: pickBranch(before), after: pickBranch(b) }, tx);
      return b;
    });
    res.json(pickBranch(after));
  },
);

router.delete(
  '/branches/:id',
  route(registry, {
    method: 'delete',
    path: '/admin/branches/:id',
    summary: 'Delete a branch no class uses (409 otherwise)',
    guard: 'admin',
    request: { params: idParams },
    responses: { 204: null, 404: null, 409: null },
  }),
  async (req, res) => {
    const b = await findBranch(req.params.id as string, req.user!.id);
    if (b._count.classes > 0) throw new HttpError(409, 'BRANCH_IN_USE', `${b._count.classes} class(es) use ${b.code}; move or archive them first`);
    await db.$transaction(async (tx) => {
      await tx.branch.delete({ where: { id: b.id } });
      await audit(req.user!, { action: 'branch.delete', targetType: 'Branch', targetId: b.id, before: pickBranch(b) }, tx);
    });
    res.status(204).end();
  },
);

export default router;

/** `GET /branches` for pickers (any logged-in user). Not under /admin: app.ts mounts it as `['/branches', branchesRouter]`. */
export const branchesRouter = Router();
branchesRouter.get(
  '/',
  auth(),
  route(registry, {
    method: 'get',
    path: '/branches',
    summary: 'Branches, for pickers',
    guard: 'auth',
    responses: { 200: z.object({ items: z.array(branch) }) },
  }),
  async (req, res) => {
    const rows = await db.branch.findMany({ where: { institutionId: await institutionOf(req.user!.id) }, orderBy: { code: 'asc' } });
    res.json({ items: rows.map(pickBranch) });
  },
);
