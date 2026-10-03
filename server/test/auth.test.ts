import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import request from 'supertest';
import { app } from '../src/app.js';
import { classAccess, hashToken, newToken, rateLimit } from '../src/lib/auth.js';
import { db } from '../src/lib/db.js';
import { errorHandler, notImplemented } from '../src/lib/http.js';
import { agent, ORIGIN, PASSWORD, resetDb } from './helpers.js';

// ponytail: login is rate limited to 10/min/IP per process; this file does 6 real logins (agent() skips login).
before(resetDb);
after(() => db.$disconnect());

const emailOf = async (id: string) => (await db.user.findUniqueOrThrow({ where: { id } })).email;
/** Real login by seeded user id; resolves to the response. */
const login = async (id: string, status: number, extra: object = {}) =>
  request(app).post('/api/v1/auth/login').send({ email: await emailOf(id), password: PASSWORD, ...extra }).expect(status);
let riyaCookie = '';

test('login: web gets an HttpOnly cookie, app gets a Bearer token; /auth/me works with both', async () => {
  const web = await login('s1', 200);
  assert.equal(web.body.token, undefined);
  const setCookie = ([] as string[]).concat(web.headers['set-cookie'] ?? []).find((c) => c.startsWith('dc_session='));
  assert.ok(setCookie);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  riyaCookie = setCookie.split(';')[0]!;

  const appRes = await login('s1', 200, { client: 'app' });
  assert.equal(typeof appRes.body.token, 'string');
  assert.equal(appRes.headers['set-cookie'], undefined);

  const viaCookie = await request(app).get('/api/v1/auth/me').set('cookie', riyaCookie).expect(200);
  const viaBearer = await request(app).get('/api/v1/auth/me').auth(appRes.body.token, { type: 'bearer' }).expect(200);
  assert.deepEqual(viaBearer.body, viaCookie.body);
  assert.equal(viaCookie.body.user.name, 'Riya Patel');
  assert.equal(viaCookie.body.user.passwordHash, undefined);
  assert.deepEqual(viaCookie.body.classes, [{ id: 'c1', name: 'CSE · 2nd year · A', role: 'cr', isClassTeacher: false }]);
  assert.deepEqual(viaCookie.body.flags, { commons: true, banned: false });

  const meera = (await (await agent('teacher')).get('/api/v1/auth/me').expect(200)).body;
  assert.deepEqual(meera.classes, [
    { id: 'c1', name: 'CSE · 2nd year · A', role: 'teacher', isClassTeacher: true },
    { id: 'c2', name: 'CSE · 2nd year · B', role: 'teacher', isClassTeacher: false },
  ]);
  assert.deepEqual(meera.flags, { commons: false, banned: false });
  const chief = (await (await agent('academics@demo.edu')).get('/api/v1/auth/me').expect(200)).body;
  assert.deepEqual([chief.user.isAdmin, chief.user.isChief, chief.classes], [true, true, []]);
});

test('wrong password and unknown email → the same 401; disabled user → 401 at login and on old sessions', async () => {
  const wrong = await request(app).post('/api/v1/auth/login').send({ email: await emailOf('s1'), password: 'nope' }).expect(401);
  const unknown = await request(app).post('/api/v1/auth/login').send({ email: 'nobody@demo.edu', password: PASSWORD }).expect(401);
  assert.deepEqual(wrong.body, unknown.body);
  assert.equal(wrong.body.error.code, 'INVALID_CREDENTIALS');

  const s2 = await agent(await emailOf('s2'));
  await s2.get('/api/v1/auth/me').expect(200);
  await db.user.update({ where: { id: 's2' }, data: { status: 'disabled' } });
  assert.deepEqual((await login('s2', 401)).body, wrong.body);
  await s2.get('/api/v1/auth/me').expect(401);

  await request(app).get('/api/v1/auth/me').expect(401);
  await request(app).get('/api/v1/auth/me').auth('garbage', { type: 'bearer' }).expect(401);
});

test('the wall: teacher on /commons/* → 403; student and admin reach the stub (501); banned → 403 BANNED', async () => {
  const [teacher, subjectTeacher, student, admin] = await Promise.all(['teacher', 'subjectTeacher', 'student', 'admin'].map((r) => agent(r)));
  for (const path of ['/api/v1/commons/people', '/api/v1/commons/board-posts/x', '/api/v1/commons/conversations']) {
    assert.equal((await teacher!.get(path).expect(403)).body.error.code, 'FORBIDDEN');
    await subjectTeacher!.get(path).expect(403);
    await admin!.get(path).expect(501);
    await student!.get(path).expect(501);
  }
  await request(app).get('/api/v1/commons/people').expect(401);
  await db.user.update({ where: { id: 's1' }, data: { bannedAt: new Date() } });
  try {
    assert.equal((await student!.get('/api/v1/commons/people').expect(403)).body.error.code, 'BANNED');
  } finally {
    await db.user.update({ where: { id: 's1' }, data: { bannedAt: null } });
  }
});

test('classAccess on the seed: CR boards, subject teacher teaches, class teacher owns, outsider is out, admin passes', async () => {
  const mini = express();
  for (const need of ['read', 'board', 'teach', 'own'] as const) mini.get(`/c/:id/${need}`, classAccess('id', need), (_req, res) => res.json({ ok: true }));
  mini.use(errorHandler);
  const cases = [
    ['cr', 'c1', [200, 200, 403, 403]],
    ['teacher', 'c1', [200, 200, 200, 200]],
    ['subjectTeacher', 'c1', [200, 403, 200, 403]],
    ['outsider', 'c2', [403, 403, 403, 403]],
    ['admin', 'c2', [200, 200, 200, 200]],
  ] as const;
  for (const [role, cls, codes] of cases) {
    const { token } = await agent(role);
    for (const [i, need] of ['read', 'board', 'teach', 'own'].entries())
      assert.equal((await request(mini).get(`/c/${cls}/${need}`).auth(token, { type: 'bearer' })).status, codes[i], `${role} ${need} ${cls}`);
  }
  const { token } = await agent('student');
  await request(mini).get('/c/nope/read').auth(token, { type: 'bearer' }).expect(404);
});

test('logout + CSRF: cookie writes need the APP_URL Origin; Bearer does not', async () => {
  assert.ok(riyaCookie, 'needs the login test');
  assert.equal((await request(app).post('/api/v1/auth/logout').set('cookie', riyaCookie).expect(403)).body.error.code, 'CSRF');
  await request(app).post('/api/v1/auth/logout').set('cookie', riyaCookie).set('origin', 'https://evil.example').expect(403);
  await request(app).post('/api/v1/auth/logout').set('cookie', riyaCookie).set('origin', ORIGIN).expect(204);
  await request(app).get('/api/v1/auth/me').set('cookie', riyaCookie).expect(401);
  const teacher = await agent('teacher');
  await teacher.post('/api/v1/auth/logout').expect(204);
  await teacher.get('/api/v1/auth/me').expect(401);
});

test('sliding expiry: a session near its end is pushed out by SESSION_DAYS', async () => {
  const { token, tokenHash } = newToken();
  await db.loginSession.create({ data: { userId: 'a1', tokenHash, userAgent: 'test', expiresAt: new Date(Date.now() + 3_600_000) } });
  await request(app).get('/api/v1/auth/me').auth(token, { type: 'bearer' }).expect(200);
  const s = await db.loginSession.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
  assert.ok(s.expiresAt.getTime() > Date.now() + 29 * 86_400_000);
  await db.loginSession.update({ where: { tokenHash }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await request(app).get('/api/v1/auth/me').auth(token, { type: 'bearer' }).expect(401);
});

test('forgot (always 200) → link in the log → reset → old sessions gone, new password works once', async (t) => {
  const s3 = await agent(await emailOf('s3'));
  const log = t.mock.method(console, 'log', () => {});
  await request(app).post('/api/v1/auth/forgot').send({ email: 'nobody@demo.edu' }).expect(200, { ok: true });
  assert.equal(log.mock.callCount(), 0);
  await request(app).post('/api/v1/auth/forgot').send({ email: s3.user.email }).expect(200, { ok: true });
  await new Promise((r) => setImmediate(r)); // sendMail is not awaited by the route
  const resetToken = log.mock.calls.map((c) => String(c.arguments[0]).match(/\/reset\/(\S+)/)?.[1]).find(Boolean);
  assert.ok(resetToken);
  log.mock.restore();

  await request(app).post('/api/v1/auth/reset').send({ token: resetToken, password: 'short' }).expect(422);
  await request(app).post('/api/v1/auth/reset').send({ token: resetToken, password: 'a brand new password' }).expect(204);
  await request(app).post('/api/v1/auth/reset').send({ token: resetToken, password: 'another new password' }).expect(410);
  await s3.get('/api/v1/auth/me').expect(401);
  await request(app).post('/api/v1/auth/login').send({ email: s3.user.email, password: 'a brand new password' }).expect(200);
});

test('rateLimit: max per window per IP → 429', async () => {
  const mini = express().post('/x', rateLimit(2, 60_000), notImplemented).use(errorHandler);
  await request(mini).post('/x').expect(501);
  await request(mini).post('/x').expect(501);
  assert.equal((await request(mini).post('/x').expect(429)).body.error.code, 'RATE_LIMITED');
});
