import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  auth,
  authenticate,
  clearSessionCookie,
  hashPassword,
  hashToken,
  rateLimit,
  sendResetLink,
  sessionToken,
  startSession,
  verifyPassword,
} from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { HttpError, notImplemented } from '../../lib/http.js';
import { registry, route } from '../../lib/openapi.js';


const user = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.enum(['student', 'staff']),
    isAdmin: z.boolean(),
    isChief: z.boolean(),
    homeClassId: z.string().nullable(),
  })
  .meta({ id: 'User' });

const me = z
  .object({
    user,
    classes: z.array(
      z.object({ id: z.string(), name: z.string(), role: z.enum(['student', 'cr', 'teacher']), isClassTeacher: z.boolean() }),
    ),
    flags: z.object({ commons: z.boolean(), banned: z.boolean() }),
  })
  .meta({ id: 'Me' });

const publicUser = ({ id, name, email, role, isAdmin, isChief, homeClassId }: z.infer<typeof user>) => ({
  id,
  name,
  email,
  role,
  isAdmin,
  isChief,
  homeClassId,
});

const password = z.string().min(8).max(200);

// Run scrypt even for unknown emails so response time doesn't reveal which emails exist.
const dummyHash = hashPassword('not-a-real-password');
const badLogin = () => new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is wrong');

const router = Router();

// D18: a lab shares one NAT IP, so count per (IP, email) and keep only a loose per-IP ceiling.
const emailOf = (req: Request) => String(req.body?.email ?? '').trim().toLowerCase().slice(0, 254); // bounded key length
const WINDOW = 15 * 60_000;

router.post(
  '/login',
  rateLimit(300, WINDOW),
  rateLimit(10, WINDOW, (req) => `${req.ip}|${emailOf(req)}`),
  rateLimit(30, WINDOW, emailOf), // per-account ceiling across IPs (no IP-rotation brute force)
  route(registry, {
    method: 'post',
    path: '/auth/login',
    summary: 'Log in; web gets the dc_session cookie, client "app" gets a Bearer token',
    guard: 'public',
    request: {
      body: z.object({ email: z.email().toLowerCase(), password: z.string().min(1).max(200), client: z.enum(['web', 'app']).default('web') }),
    },
    responses: { 200: z.object({ user, token: z.string().optional() }) },
  }),
  async (req, res) => {
    const { email, password: pw, client } = req.body as { email: string; password: string; client: 'web' | 'app' };
    const found = await db.user.findUnique({ where: { email } });
    const ok = await verifyPassword(pw, found?.passwordHash ?? (await dummyHash));
    if (!found || !found.passwordHash || !ok || found.status !== 'active') throw badLogin();
    const token = await startSession(req, res, found.id, client);
    res.json({ user: publicUser(found), ...(token && { token }) });
  },
);

router.post(
  '/logout',
  auth(),
  route(registry, { method: 'post', path: '/auth/logout', summary: 'End this session', guard: 'auth', responses: { 204: null } }),
  async (req, res) => {
    const found = sessionToken(req);
    if (found) await db.loginSession.deleteMany({ where: { tokenHash: hashToken(found.token) } });
    clearSessionCookie(res).status(204).end();
  },
);

router.get(
  '/me',
  route(registry, { method: 'get', path: '/auth/me', summary: 'The logged-in user, their classes and flags', guard: 'auth', responses: { 200: me } }),
  async (req, res) => {
    const u = await authenticate(req, res);
    const classes = await db.class.findMany({
      where: { archivedAt: null, OR: [{ classTeacherId: u.id }, { members: { some: { userId: u.id } } }] },
      select: { id: true, name: true, classTeacherId: true, members: { where: { userId: u.id }, select: { role: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({
      user: publicUser(u),
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        role: c.members[0]?.role ?? 'teacher',
        isClassTeacher: c.classTeacherId === u.id,
      })),
      flags: { commons: u.isAdmin || (u.role === 'student' && !u.bannedAt), banned: !!u.bannedAt },
    });
  },
);

router.post(
  '/forgot',
  rateLimit(30, 60_000),
  rateLimit(10, 60_000, emailOf),
  rateLimit(3, WINDOW, emailOf), // R8: 3 mails / 15 min per address
  route(registry, {
    method: 'post',
    path: '/auth/forgot',
    summary: 'Email a password reset link; always 200 so emails cannot be probed',
    guard: 'public',
    request: { body: z.object({ email: z.email().toLowerCase() }) },
    responses: { 200: z.object({ ok: z.boolean() }) },
  }),
  async (req, res) => {
    const found = await db.user.findUnique({ where: { email: (req.body as { email: string }).email } });
    if (found?.status === 'active') {
      // Not awaited: same response time and status whether or not the email exists.
      sendResetLink(found, "Someone asked to reset your Digital Campus password. If it wasn't you, ignore this email. Otherwise set a new one here:").catch(
        (err: Error) => console.error(`[mail] reset email failed: ${err.message}`),
      );
    }
    res.json({ ok: true });
  },
);

router.post(
  '/reset',
  route(registry, {
    method: 'post',
    path: '/auth/reset',
    summary: 'Set a new password with a reset token; logs out every session',
    guard: 'public',
    request: { body: z.object({ token: z.string().min(1), password }) },
    responses: { 204: null },
  }),
  async (req, res) => {
    const body = req.body as { token: string; password: string };
    const reset = await db.passwordReset.findUnique({ where: { tokenHash: hashToken(body.token) } });
    if (!reset || reset.usedAt || reset.expiresAt.getTime() <= Date.now())
      throw new HttpError(410, 'RESET_EXPIRED', 'This reset link has expired, ask for a new one');
    const passwordHash = await hashPassword(body.password);
    await db.$transaction(async (tx) => {
      // Conditional update = single use: a concurrent second reset matches 0 rows.
      const used = await tx.passwordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: new Date() } });
      if (used.count !== 1) throw new HttpError(410, 'RESET_EXPIRED', 'This reset link has expired, ask for a new one');
      await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
      await tx.loginSession.deleteMany({ where: { userId: reset.userId } });
    });
    res.status(204).end();
  },
);

// --- invites (FND-05): created internally by CS-02 / AD-01 via createInvite ---
const inviteGone = () => new HttpError(410, 'INVITE_EXPIRED', 'This invite link has expired or was already used, ask for a new one');
const tokenParams = z.object({ token: z.string().min(1) });
const goneBody = z.object({ error: z.object({ code: z.literal('INVITE_EXPIRED'), message: z.string() }) });

/** A pending, unexpired invite whose user is still `invited`, or 410. */
const pendingInvite = async (token: string) => {
  const invite = await db.invite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { invitedBy: { select: { name: true } }, class: { select: { name: true } } },
  });
  if (!invite || invite.acceptedAt || invite.expiresAt.getTime() <= Date.now()) throw inviteGone();
  const invitee = await db.user.findUnique({ where: { email: invite.email } });
  if (invitee?.status !== 'invited') throw inviteGone();
  return { invite, invitee };
};

router.get(
  '/invite/:token',
  route(registry, {
    method: 'get',
    path: '/auth/invite/:token',
    summary: 'The read-only fields for the invite page; used or expired → 410',
    guard: 'public',
    request: { params: tokenParams },
    responses: {
      200: z.object({ email: z.string(), studentIdNo: z.string().optional(), className: z.string().optional(), invitedBy: z.string() }),
      410: goneBody,
    },
  }),
  async (req, res) => {
    const { invite, invitee } = await pendingInvite((req.params as { token: string }).token);
    res.json({
      email: invite.email,
      ...(invitee.studentIdNo && { studentIdNo: invitee.studentIdNo }),
      ...(invite.class && { className: invite.class.name }),
      invitedBy: invite.invitedBy.name,
    });
  },
);

router.post(
  '/invite/:token/accept',
  route(registry, {
    method: 'post',
    path: '/auth/invite/:token/accept',
    summary: 'Set a password, activate the account and log in (single use); used or expired → 410',
    guard: 'public',
    request: {
      params: tokenParams,
      body: z.object({ password, name: z.string().trim().min(1).max(100).optional(), client: z.enum(['web', 'app']).default('web') }),
    },
    responses: { 200: z.object({ user, token: z.string().optional() }), 410: goneBody },
  }),
  async (req, res) => {
    const { invite, invitee } = await pendingInvite((req.params as { token: string }).token);
    const body = req.body as { password: string; name?: string; client: 'web' | 'app' };
    const passwordHash = await hashPassword(body.password);
    const activated = await db.$transaction(async (tx) => {
      // The conditional update is the single-use lock: a concurrent second accept matches 0 rows.
      const used = await tx.invite.updateMany({ where: { id: invite.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
      if (used.count !== 1) throw inviteGone();
      const done = await tx.user.updateMany({
        where: { id: invitee.id, status: 'invited' },
        data: { status: 'active', passwordHash, ...(body.name && { name: body.name }) },
      });
      if (done.count !== 1) throw inviteGone();
      return tx.user.findUniqueOrThrow({ where: { id: invitee.id } });
    });
    const token = await startSession(req, res, activated.id, body.client);
    res.json({ user: publicUser(activated), ...(token && { token }) });
  },
);

router.use(notImplemented);
export default router;
