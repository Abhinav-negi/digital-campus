import { Router } from 'express';
import { z } from 'zod';
import { config } from '../../config.js';
import {
  auth,
  authenticate,
  clearSessionCookie,
  hashPassword,
  hashToken,
  newToken,
  rateLimit,
  sessionToken,
  startSession,
  verifyPassword,
} from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { HttpError, notImplemented } from '../../lib/http.js';
import { registry, route } from '../../lib/openapi.js';

const RESET_MS = 60 * 60 * 1000;

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

router.post(
  '/login',
  rateLimit(10, 60_000),
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
  rateLimit(10, 60_000),
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
      const { token, tokenHash } = newToken();
      await db.passwordReset.create({ data: { userId: found.id, tokenHash, expiresAt: new Date(Date.now() + RESET_MS) } });
      // FND-05: replace with sendMail(). Until then the link is printed only in the D14 dev fallback, never in prod.
      if (!config.SMTP_HOST && config.NODE_ENV !== 'production')
        console.log(`[mail] to=${found.email} subject="Reset your password" link=${config.APP_URL}/reset/${token}`);
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
    await db.$transaction([
      db.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      db.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      db.loginSession.deleteMany({ where: { userId: reset.userId } }),
    ]);
    res.status(204).end();
  },
);

// Invite accept etc. (FND-05) are still stubs.
router.use(notImplemented);
export default router;
