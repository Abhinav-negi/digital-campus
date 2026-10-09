import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../../lib/audit.js';
import { clearSessionCookie, rateLimit, sendResetLink, verifyPassword } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { HttpError, page, pageQuery, paginate } from '../../lib/http.js';
import { registry, route } from '../../lib/openapi.js';
import { createInvite } from '../invites/service.js';
import { institutionOf } from './school.js';

// AD-01: users directory, staff invites, account control, SPEC §12 deletion. Mounted under /admin, behind admin().


const adminUser = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.enum(['student', 'staff']),
    isAdmin: z.boolean(),
    isChief: z.boolean(),
    status: z.enum(['invited', 'active', 'disabled']),
    dept: z.string().nullable(),
    studentIdNo: z.string().nullable(),
    homeClass: z.object({ id: z.string(), name: z.string() }).nullable(),
    lastLoginAt: z.iso.datetime().nullable(),
    bannedAt: z.iso.datetime().nullable(), // AD-06 Commons ban
  })
  .meta({ id: 'AdminUser' });

const idParams = z.object({ id: z.string().min(1) });
const notFound = () => new HttpError(404, 'NOT_FOUND', 'User not found');
const DELETED_DOMAIN = '@deleted.invalid';
/** A SPEC §12-deleted (anonymised) account: admin actions treat it as gone, so it can never be re-enabled. */
export const isDeleted = (u: { email: string }) => u.email.endsWith(DELETED_DOMAIN);

const userInclude = {
  homeClass: { select: { id: true, name: true } },
  sessions: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
} as const;

type Row = Awaited<ReturnType<typeof findRow>>;
const findRow = (id: string) => db.user.findUniqueOrThrow({ where: { id }, include: userInclude });
const toAdminUser = (u: Row): z.infer<typeof adminUser> => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  isAdmin: u.isAdmin,
  isChief: u.isChief,
  status: u.status,
  dept: u.dept,
  studentIdNo: u.studentIdNo,
  homeClass: u.homeClass,
  lastLoginAt: u.sessions[0]?.createdAt.toISOString() ?? null,
  bannedAt: u.bannedAt?.toISOString() ?? null,
});

const router = Router();

const listQuery = pageQuery.extend({
  q: z.string().trim().min(1).optional(),
  role: z.enum(['student', 'staff']).optional(),
  branchId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  status: z.enum(['invited', 'active', 'disabled']).optional(),
});

router.get(
  '/users',
  route(registry, {
    method: 'get',
    path: '/admin/users',
    summary: 'Everyone, filterable; q matches name, email or student ID',
    guard: 'admin',
    request: { query: listQuery },
    responses: { 200: z.object({ items: z.array(adminUser), nextCursor: z.string().nullable() }) },
  }),
  async (req, res) => {
    const { q, role, branchId, classId, status, cursor, limit } = req.query as unknown as z.infer<typeof listQuery>;
    const contains = q && { contains: q, mode: 'insensitive' as const };
    const rows = await db.user.findMany({
      where: {
        institutionId: await institutionOf(req.user!.id),
        role,
        status,
        homeClassId: classId,
        ...(branchId && { homeClass: { branchId } }),
        ...(contains && { OR: [{ name: contains }, { email: contains }, { studentIdNo: contains }] }),
      },
      include: userInclude,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      ...paginate(cursor, limit),
    });
    const p = page(rows, limit);
    res.json({ items: p.items.map(toAdminUser), nextCursor: p.nextCursor });
  },
);

const inviteBody = z.object({ name: z.string().trim().min(1).max(120), email: z.email().toLowerCase(), dept: z.string().trim().min(1).max(120) });

router.post(
  '/staff-invites',
  route(registry, {
    method: 'post',
    path: '/admin/staff-invites',
    summary: 'Invite a teacher by email (D3); re-posting a pending email resends the link',
    guard: 'admin',
    request: { body: inviteBody },
    responses: { 201: z.object({ user: adminUser, invite: z.object({ id: z.string(), expiresAt: z.iso.datetime() }) }), 409: null },
  }),
  async (req, res) => {
    const { name, email, dept } = req.body as z.infer<typeof inviteBody>;
    const existing = await db.user.findUnique({ where: { email } });
    if (existing && (existing.status !== 'invited' || existing.role !== 'staff'))
      throw new HttpError(409, 'ACCOUNT_EXISTS', `${email} already has an account`);
    const institutionId = await institutionOf(req.user!.id);
    const user = await db.$transaction(async (tx) => {
      const u = existing
        ? await tx.user.update({ where: { id: existing.id }, data: { name, dept } })
        : await tx.user.create({ data: { institutionId, role: 'staff', status: 'invited', name, email, dept } });
      await audit(req.user!, { action: existing ? 'staff.invite.resend' : 'staff.invite', targetType: 'User', targetId: u.id, after: { name, email, dept } }, tx);
      return u;
    });
    // After the commit: createInvite sends mail (FND-05).
    const invite = await createInvite({ email, role: 'staff', invitedById: req.user!.id });
    res.status(201).json({ user: toAdminUser(await findRow(user.id)), invite: { id: invite.id, expiresAt: invite.expiresAt.toISOString() } });
  },
);

const statusBody = z.object({ status: z.enum(['active', 'disabled']) });

router.patch(
  '/users/:id/status',
  route(registry, {
    method: 'patch',
    path: '/admin/users/:id/status',
    summary: 'Enable or disable an account; disabling ends all its sessions. The chief cannot be disabled.',
    guard: 'admin',
    request: { params: idParams, body: statusBody },
    responses: { 200: adminUser, 404: null, 409: null },
  }),
  async (req, res) => {
    const { status } = req.body as z.infer<typeof statusBody>;
    const target = await db.user.findUnique({ where: { id: req.params.id as string } });
    if (!target || isDeleted(target)) throw notFound();
    if (target.isChief && status === 'disabled') throw new HttpError(409, 'CHIEF', 'The chief admin cannot be disabled');
    if (target.status === 'invited') throw new HttpError(409, 'INVITE_PENDING', 'This person has not accepted their invite yet');
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: target.id }, data: { status } });
      if (status === 'disabled') await tx.loginSession.deleteMany({ where: { userId: target.id } });
      await audit(req.user!, { action: `user.${status === 'disabled' ? 'disable' : 'enable'}`, targetType: 'User', targetId: target.id, before: { status: target.status }, after: { status } }, tx);
    });
    res.json(toAdminUser(await findRow(target.id)));
  },
);

router.post(
  '/users/:id/reset-password',
  route(registry, {
    method: 'post',
    path: '/admin/users/:id/reset-password',
    summary: 'Email the user a password reset link (the /auth/forgot flow)',
    guard: 'admin',
    request: { params: idParams },
    responses: { 204: null, 404: null, 409: null },
  }),
  async (req, res) => {
    const target = await db.user.findUnique({ where: { id: req.params.id as string } });
    if (!target || isDeleted(target)) throw notFound();
    if (target.status !== 'active') throw new HttpError(409, 'NOT_ACTIVE', 'Only active accounts can reset their password');
    await audit(req.user!, { action: 'user.password.reset', targetType: 'User', targetId: target.id });
    await sendResetLink(target, 'An admin sent you a link to reset your Digital Campus password:');
    res.status(204).end();
  },
);

/**
 * SPEC §12 account deletion, shared by DELETE /admin/users/:id and DELETE /me.
 * The User row stays (history FKs are Restrict, schema header) but is anonymised and disabled: attendance, tickets,
 * class-board edits and audit rows keep pointing at "Deleted student". Commons content and personal rows are removed.
 */
export const deleteUser = async (id: string, actor: { id: string }) => {
  const target = await db.user.findUnique({ where: { id } });
  if (!target || isDeleted(target)) throw notFound();
  if (target.isChief) throw new HttpError(409, 'CHIEF', 'The chief admin account cannot be deleted');
  if (await db.class.count({ where: { classTeacherId: id, archivedAt: null } }))
    throw new HttpError(409, 'CLASS_TEACHER', 'Hand over their classes to another class teacher first');

  const me = { userId: id };
  await db.$transaction(async (tx) => {
    // Commons content (cascades take answers/interests/claims on their posts, members/requests/updates on their projects,
    // submissions on their challenges, messages in their conversations).
    await tx.conversation.deleteMany({ where: { OR: [{ fromId: id }, { toId: id }] } });
    await tx.thanks.deleteMany({ where: { OR: [{ fromId: id }, { toId: id }] } });
    await tx.answer.deleteMany({ where: { authorId: id } });
    await tx.boardPost.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } });
    await tx.boardPost.deleteMany({ where: { authorId: id } });
    await tx.projectUpdate.deleteMany({ where: { authorId: id } });
    await tx.project.deleteMany({ where: { ownerId: id } });
    await tx.submission.deleteMany({ where: { userId: id } });
    await tx.challenge.deleteMany({ where: { ownerId: id } });
    await tx.report.deleteMany({ where: { reporterId: id } });
    await tx.block.deleteMany({ where: { OR: [me, { blockedId: id }] } });
    await tx.interest.deleteMany({ where: me });
    await tx.claim.deleteMany({ where: me });
    await tx.projectMember.deleteMany({ where: me });
    await tx.joinRequest.deleteMany({ where: me });
    await tx.submissionLike.deleteMany({ where: me });
    await tx.profile.deleteMany({ where: me });
    // Personal rows and access.
    await tx.notification.deleteMany({ where: me });
    await tx.reminder.deleteMany({ where: { teacherId: id } });
    await tx.postSeen.deleteMany({ where: me });
    await tx.classMember.deleteMany({ where: me });
    await tx.subject.updateMany({ where: { teacherId: id }, data: { teacherId: null } });
    await tx.loginSession.deleteMany({ where: me });
    await tx.passwordReset.deleteMany({ where: me });
    await tx.invite.deleteMany({ where: { email: target.email, acceptedAt: null } });
    await tx.user.update({
      where: { id },
      data: {
        name: target.role === 'student' ? 'Deleted student' : 'Deleted teacher',
        email: `deleted-${id}${DELETED_DOMAIN}`,
        passwordHash: null,
        status: 'disabled',
        isAdmin: false,
        bannedAt: null,
        homeClassId: null,
        studentIdNo: null,
        dept: null,
      },
    });
    // No name/email in the log: that would undo the anonymisation.
    await audit(actor, { action: 'user.delete', targetType: 'User', targetId: id, before: { role: target.role, status: target.status } }, tx);
  });
};

router.delete(
  '/users/:id',
  route(registry, {
    method: 'delete',
    path: '/admin/users/:id',
    summary: 'Delete an account (SPEC §12): anonymised, attendance kept, Commons content removed',
    guard: 'admin',
    request: { params: idParams },
    responses: { 204: null, 404: null, 409: null },
  }),
  async (req, res) => {
    await deleteUser(req.params.id as string, req.user!);
    res.status(204).end();
  },
);

export default router;

const deleteMeBody = z.object({ password: z.string().min(1).max(200) });

/** `DELETE /me {password}`: self-delete (SPEC §12). Mounted by me/routes.ts, which already runs auth(). */
export const deleteMeRouter = Router();
deleteMeRouter.delete(
  '/',
  rateLimit(10, 60_000),
  route(registry, {
    method: 'delete',
    path: '/me',
    summary: 'Delete my account (SPEC §12); needs my password. Not for the chief.',
    guard: 'auth',
    request: { body: deleteMeBody },
    responses: { 204: null, 403: null, 409: null },
  }),
  async (req, res) => {
    const { passwordHash } = await db.user.findUniqueOrThrow({ where: { id: req.user!.id }, select: { passwordHash: true } });
    const ok = !!passwordHash && (await verifyPassword((req.body as z.infer<typeof deleteMeBody>).password, passwordHash));
    if (!ok) throw new HttpError(403, 'INVALID_CREDENTIALS', 'Password is wrong');
    await deleteUser(req.user!.id, req.user!);
    clearSessionCookie(res).status(204).end();
  },
);
