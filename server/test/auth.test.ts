import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { app } from '../src/app.js';
import { classAccess, commons, hashPassword, hashToken, newToken, rateLimit } from '../src/lib/auth.js';
import { db } from '../src/lib/db.js';
import { errorHandler, notImplemented } from '../src/lib/http.js';
import commonsRouter from '../src/modules/commons/routes.js';

// No seed yet (FND-03): these tests make their own users and delete them after.
// ponytail: login is rate limited to 10/min/IP per process, so this file stays at ≤10 logins.
const tag = `t${Date.now().toString(36)}`;
const PW = 'correct horse battery';
const ORIGIN = 'http://localhost:5173'; // APP_URL in .env.example
const ids: Record<string, string> = {};
const tokens: Record<string, string> = {};
const cookies: Record<string, string> = {};
let classId = '';

const email = (name: string) => `${name}.${tag}@test.local`;

before(async () => {
  const inst = await db.institution.create({ data: { name: `Test ${tag}` } });
  ids.inst = inst.id;
  const passwordHash = await hashPassword(PW);
  const mk = async (name: string, data: { role: 'student' | 'staff'; isAdmin?: boolean; status?: 'active' | 'disabled' }) =>
    (ids[name] = (
      await db.user.create({ data: { institutionId: inst.id, name, email: email(name), passwordHash, status: 'active', ...data } })
    ).id);
  await mk('student', { role: 'student' });
  await mk('teacher', { role: 'staff' });
  await mk('admin', { role: 'staff', isAdmin: true });
  await mk('disabled', { role: 'student', status: 'disabled' });
  await mk('resetter', { role: 'student' });
  const branch = await db.branch.create({ data: { institutionId: inst.id, code: tag, name: 'Test branch' } });
  ids.branch = branch.id;
  const cls = await db.class.create({
    data: { institutionId: inst.id, branchId: branch.id, admissionYear: 2025, section: 'A', name: `Test ${tag}`, classTeacherId: ids.teacher! },
  });
  classId = cls.id;
  await db.classMember.create({ data: { classId, userId: ids.student!, role: 'student' } });
});

after(async () => {
  await db.class.deleteMany({ where: { id: classId } });
  await db.user.deleteMany({ where: { institutionId: ids.inst } });
  await db.institution.deleteMany({ where: { id: ids.inst } }); // cascades the branch
  await db.$disconnect();
});

const login = (name: string, client?: 'app') =>
  request(app)
    .post('/api/v1/auth/login')
    .send({ email: email(name), password: PW, ...(client && { client }) });

test('login as student, teacher, admin via cookie and Bearer; /auth/me works with both', async () => {
  for (const [name, role] of [
    ['student', 'student'],
    ['teacher', 'staff'],
    ['admin', 'staff'],
  ] as const) {
    const web = await login(name).expect(200);
    assert.equal(web.body.token, undefined);
    const setCookie = ([] as string[]).concat(web.headers['set-cookie'] ?? []).find((c) => c.startsWith('dc_session='));
    assert.ok(setCookie, name);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);
    cookies[name] = setCookie.split(';')[0]!;

    const appRes = await login(name, 'app').expect(200);
    assert.equal(typeof appRes.body.token, 'string');
    assert.equal(appRes.headers['set-cookie'], undefined);
    tokens[name] = appRes.body.token;

    const viaCookie = await request(app).get('/api/v1/auth/me').set('cookie', cookies[name]!).expect(200);
    const viaBearer = await request(app).get('/api/v1/auth/me').auth(tokens[name]!, { type: 'bearer' }).expect(200);
    assert.equal(viaCookie.body.user.role, role);
    assert.deepEqual(viaBearer.body, viaCookie.body);
  }
  const me = (await request(app).get('/api/v1/auth/me').auth(tokens.teacher!, { type: 'bearer' })).body;
  assert.deepEqual(me.classes, [{ id: classId, name: `Test ${tag}`, role: 'teacher', isClassTeacher: true }]);
  assert.deepEqual(me.flags, { commons: false, banned: false });
  assert.equal(me.user.passwordHash, undefined);
});

test('wrong password and unknown email → the same 401; disabled user → 401', async () => {
  const wrong = await request(app).post('/api/v1/auth/login').send({ email: email('student'), password: 'nope' }).expect(401);
  const unknown = await request(app).post('/api/v1/auth/login').send({ email: email('nobody'), password: PW }).expect(401);
  assert.deepEqual(wrong.body, unknown.body);
  assert.equal(wrong.body.error.code, 'INVALID_CREDENTIALS');
  const disabled = await login('disabled').expect(401);
  assert.deepEqual(disabled.body, wrong.body);
  await request(app).get('/api/v1/auth/me').expect(401);
  await request(app).get('/api/v1/auth/me').auth('garbage', { type: 'bearer' }).expect(401);
});

test('the wall: teacher on /commons/* → 403, student and admin reach the stub (501), banned → 403 BANNED', async () => {
  // Mirrors the proposed app wiring: the commons router mounted behind commons().
  const mini = express().use(cookieParser()).use('/commons', commons(), commonsRouter).use(errorHandler);
  const as = (name: string, path = '/commons/people') => request(mini).get(path).auth(tokens[name]!, { type: 'bearer' });
  for (const path of ['/commons/people', '/commons/board-posts/x', '/commons/conversations']) {
    assert.equal((await as('teacher', path).expect(403)).body.error.code, 'FORBIDDEN');
    await as('admin', path).expect(501);
    await as('student', path).expect(501);
  }
  await request(mini).get('/commons/people').expect(401);
  await db.user.update({ where: { id: ids.student! }, data: { bannedAt: new Date() } });
  try {
    assert.equal((await as('student').expect(403)).body.error.code, 'BANNED');
  } finally {
    await db.user.update({ where: { id: ids.student! }, data: { bannedAt: null } });
  }
});

test('classAccess: member reads, CR-only board, class teacher owns, admin passes all', async () => {
  const mini = express();
  for (const need of ['read', 'board', 'teach', 'own'] as const) mini.get(`/c/:id/${need}`, classAccess('id', need), (_req, res) => res.json({ ok: true }));
  mini.use(errorHandler);
  const as = (name: string, need: string, id = classId) => request(mini).get(`/c/${id}/${need}`).auth(tokens[name]!, { type: 'bearer' });
  const expect = { student: [200, 403, 403, 403], teacher: [200, 200, 200, 200], admin: [200, 200, 200, 200] };
  for (const [name, codes] of Object.entries(expect))
    for (const [i, need] of ['read', 'board', 'teach', 'own'].entries()) assert.equal((await as(name, need)).status, codes[i], `${name} ${need}`);
  await as('student', 'read', 'nope').expect(404);
});

test('CSRF: cookie writes need the APP_URL Origin; Bearer does not', async () => {
  const cookie = cookies.student!;
  assert.equal((await request(app).post('/api/v1/auth/logout').set('cookie', cookie).expect(403)).body.error.code, 'CSRF');
  await request(app).post('/api/v1/auth/logout').set('cookie', cookie).set('origin', 'https://evil.example').expect(403);
  await request(app).post('/api/v1/auth/logout').set('cookie', cookie).set('origin', ORIGIN).expect(204);
  await request(app).get('/api/v1/auth/me').set('cookie', cookie).expect(401);
  await request(app).post('/api/v1/auth/logout').auth(tokens.teacher!, { type: 'bearer' }).expect(204);
  await request(app).get('/api/v1/auth/me').auth(tokens.teacher!, { type: 'bearer' }).expect(401);
});

test('sliding expiry: a session near its end is pushed out by SESSION_DAYS', async () => {
  const { token, tokenHash } = newToken();
  await db.loginSession.create({ data: { userId: ids.admin!, tokenHash, userAgent: 'test', expiresAt: new Date(Date.now() + 3_600_000) } });
  await request(app).get('/api/v1/auth/me').auth(token, { type: 'bearer' }).expect(200);
  const s = await db.loginSession.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
  assert.ok(s.expiresAt.getTime() > Date.now() + 29 * 86_400_000);
  await db.loginSession.update({ where: { tokenHash }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await request(app).get('/api/v1/auth/me').auth(token, { type: 'bearer' }).expect(401);
});

test('forgot (always 200) → link in the log → reset → old sessions gone, new password works once', async (t) => {
  const { token: oldToken, tokenHash } = newToken();
  await db.loginSession.create({ data: { userId: ids.resetter!, tokenHash, userAgent: 'test', expiresAt: new Date(Date.now() + 86_400_000) } });
  const log = t.mock.method(console, 'log', () => {});
  await request(app).post('/api/v1/auth/forgot').send({ email: email('nobody') }).expect(200, { ok: true });
  assert.equal(log.mock.callCount(), 0);
  await request(app).post('/api/v1/auth/forgot').send({ email: email('resetter') }).expect(200, { ok: true });
  const resetToken = String(log.mock.calls[0]?.arguments[0]).match(/\/reset\/(\S+)/)?.[1];
  assert.ok(resetToken);
  log.mock.restore();

  await request(app).post('/api/v1/auth/reset').send({ token: resetToken, password: 'short' }).expect(422);
  await request(app).post('/api/v1/auth/reset').send({ token: resetToken, password: 'a brand new password' }).expect(204);
  await request(app).post('/api/v1/auth/reset').send({ token: resetToken, password: 'another new password' }).expect(410);
  await request(app).get('/api/v1/auth/me').auth(oldToken, { type: 'bearer' }).expect(401);
  await request(app).post('/api/v1/auth/login').send({ email: email('resetter'), password: 'a brand new password' }).expect(200);
});

test('rateLimit: max per window per IP → 429', async () => {
  const mini = express()
    .post('/x', rateLimit(2, 60_000), notImplemented)
    .use(errorHandler);
  await request(mini).post('/x').expect(501);
  await request(mini).post('/x').expect(501);
  assert.equal((await request(mini).post('/x').expect(429)).body.error.code, 'RATE_LIMITED');
});
