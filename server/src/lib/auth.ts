import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Request, RequestHandler, Response } from 'express';
import { config } from '../config.js';
import { db } from './db.js';
import { HttpError } from './http.js';
import { sendMail } from './mail.js';

// The wall (ARCH §3). Every guard authenticates on its own, so `router.use(commons())` is enough;
// stacking `auth(), commons()` costs one session lookup, not two.

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isAdmin: true,
  isChief: true,
  homeClassId: true,
  bannedAt: true,
  bannedUntil: true,
  status: true,
} as const;

export type AuthUser = { id: string; name: string; email: string; role: 'student' | 'staff'; isAdmin: boolean; isChief: boolean; homeClassId: string | null; bannedAt: Date | null };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// --- passwords: scrypt, stored as `salt:hash` (hex) ---
const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const hashPassword = async (password: string) => {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${(await scryptAsync(password, salt, 64)).toString('hex')}`;
};

export const verifyPassword = async (password: string, stored: string) => {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = await scryptAsync(password, Buffer.from(salt, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
};

// --- tokens: 32 random bytes to the client, SHA-256 in the DB (sessions, resets, invites) ---
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const newToken = () => {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
};

// --- password reset links (forgot + admin reset share one token/expiry rule) ---
const RESET_MS = 60 * 60 * 1000;

/** Store a single-use reset token (1 hour) and email the link; `intro` is the line above the link. */
export const sendResetLink = async (user: { id: string; email: string; name: string }, intro: string) => {
  const { token, tokenHash } = newToken();
  await db.passwordReset.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_MS) } });
  await sendMail(user.email, 'Reset your password', `Hi ${user.name},\n\n${intro}\n\n${config.APP_URL}/reset/${token}\n\nThe link expires in an hour.\n`);
};

// --- sessions ---
const COOKIE = 'dc_session';
const DAY = 86_400_000;
const sessionMs = () => config.SESSION_DAYS * DAY;
const appOrigin = new URL(config.APP_URL).origin;

const setCookie = (res: Response, token: string) =>
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.COOKIE_SECURE, maxAge: sessionMs(), path: '/' });

export const clearSessionCookie = (res: Response) => res.clearCookie(COOKIE, { path: '/' });

/** Log `userId` in: web gets the cookie, `client: 'app'` gets the token back (ARCH §14). Also used by invite accept (FND-05). */
export const startSession = async (req: Request, res: Response, userId: string, client: 'web' | 'app') => {
  const { token, tokenHash } = newToken();
  await db.loginSession.create({
    data: { userId, tokenHash, expiresAt: new Date(Date.now() + sessionMs()), userAgent: req.get('user-agent') ?? '', deviceId: req.deviceId ?? null },
  });
  if (client === 'app') return token;
  setCookie(res, token);
  return undefined;
};

/** Bearer wins over the cookie; `viaCookie` turns on the CSRF check. */
export const sessionToken = (req: Request) => {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return { token: header.slice(7), viaCookie: false };
  const cookie: unknown = req.cookies?.[COOKIE];
  return typeof cookie === 'string' && cookie ? { token: cookie, viaCookie: true } : null;
};

const unauthenticated = () => new HttpError(401, 'UNAUTHENTICATED', 'Please log in');
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Resolve `req.user` once per request, or throw 401. */
export const authenticate = async (req: Request, res: Response): Promise<AuthUser> => {
  if (req.user) return req.user;
  const found = sessionToken(req);
  if (!found) throw unauthenticated();
  const session = await db.loginSession.findUnique({ where: { tokenHash: hashToken(found.token) }, include: { user: { select: userSelect } } });
  if (!session || session.expiresAt.getTime() <= Date.now() || session.user.status !== 'active') throw unauthenticated();
  if (found.viaCookie && !SAFE_METHODS.has(req.method) && req.get('origin') !== appOrigin)
    throw new HttpError(403, 'CSRF', 'Request origin not allowed');

  // Sliding expiry, written at most once a day per session.
  if (session.expiresAt.getTime() < Date.now() + sessionMs() - DAY) {
    await db.loginSession.update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() + sessionMs()) } });
    if (found.viaCookie) setCookie(res, found.token);
  }
  // A ban with an end date lifts itself on the banned student's next request (the hourly job catches the rest).
  if (session.user.bannedUntil && session.user.bannedUntil.getTime() <= Date.now()) {
    await db.user.update({ where: { id: session.user.id }, data: { bannedAt: null, bannedUntil: null } });
    Object.assign(session.user, { bannedAt: null, bannedUntil: null });
  }
  const { status: _status, bannedUntil: _until, ...user } = session.user;
  req.user = user;
  return user;
};

// --- guards (ARCH §3); `isAdmin` passes all but chief() ---
const guard =
  (allow: (u: AuthUser) => boolean, message = 'You do not have access to this'): RequestHandler =>
  async (req, res, next) => {
    const user = await authenticate(req, res);
    if (!user.isAdmin && !allow(user)) throw new HttpError(403, 'FORBIDDEN', message);
    next();
  };

export const auth = () => guard(() => true);
export const staff = () => guard((u) => u.role === 'staff');
export const admin = () => guard(() => false, 'Admins only');
/** The seeded chief only (D1); being an admin is not enough. */
export const chief = (): RequestHandler => async (req, res, next) => {
  if (!(await authenticate(req, res)).isChief) throw new HttpError(403, 'FORBIDDEN', 'Chief admin only');
  next();
};
/** The wall: students and admins only; teachers get 403. Mount the whole Commons router behind it. */
export const commons = (): RequestHandler => async (req, res, next) => {
  const user = await authenticate(req, res);
  if (user.isAdmin) return next();
  if (user.role !== 'student') throw new HttpError(403, 'FORBIDDEN', 'The Commons is for students');
  if (user.bannedAt) throw new HttpError(403, 'BANNED', 'You are banned from the Commons');
  next();
};

export type ClassNeed = 'read' | 'board' | 'teach' | 'own';

/**
 * Class-scoped access from `ClassMember` + `Subject.teacherId` (ARCH §3):
 * read = any member, the class teacher, or a teacher of an active-term subject · board = CR or class teacher ·
 * teach = class teacher or teacher of an active-term subject (never the CR) · own = class teacher.
 * Per-subject checks ("own subjects only") stay in the handler.
 */
export const classAccess =
  (classIdParam: string, need: ClassNeed): RequestHandler =>
  async (req, res, next) => {
    const user = await authenticate(req, res);
    if (user.isAdmin) return next();
    const id: unknown = req.params[classIdParam];
    const cls =
      typeof id === 'string'
        ? await db.class.findUnique({
            where: { id },
            select: {
              classTeacherId: true,
              members: { where: { userId: user.id }, select: { role: true } },
              subjects: { where: { teacherId: user.id, term: { endedAt: null } }, select: { id: true }, take: 1 },
            },
          })
        : null;
    if (!cls) throw new HttpError(404, 'NOT_FOUND', 'Class not found');
    const own = cls.classTeacherId === user.id;
    const role = cls.members[0]?.role;
    const teaches = cls.subjects.length > 0;
    const ok = { read: own || !!role || teaches, board: own || role === 'cr', teach: own || teaches, own }[need];
    if (!ok) throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this class');
    next();
  };

/** Fixed-window limiter (keyed per IP unless `keyOf` says otherwise) → 429 RATE_LIMITED. */
// ponytail: in-memory, so the limit is per process; move to a Postgres/Redis counter if we ever run >1 instance.
export const rateLimit = (max: number, windowMs: number, keyOf: (req: Request) => string = (req) => req.ip ?? ''): RequestHandler => {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req, _res, next) => {
    const now = Date.now();
    const key = keyOf(req);
    let hit = hits.get(key);
    if (!hit || hit.resetAt <= now) {
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      hit = { count: 0, resetAt: now + windowMs };
      hits.set(key, hit);
    }
    if (++hit.count > max) throw new HttpError(429, 'RATE_LIMITED', 'Too many attempts, try again in a minute');
    next();
  };
};
