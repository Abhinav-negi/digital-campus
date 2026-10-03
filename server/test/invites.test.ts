import assert from 'node:assert/strict';
import { after, before, test, type TestContext } from 'node:test';
import request from 'supertest';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { db } from '../src/lib/db.js';
import { sendMail } from '../src/lib/mail.js';
import { createInvite } from '../src/modules/invites/service.js';

const tag = `i${Date.now().toString(36)}`;
const PW = 'correct horse battery';
const email = (name: string) => `${name}.${tag}@test.local`;
const ids: Record<string, string> = {};
let classId = '';

before(async () => {
  const inst = await db.institution.create({ data: { name: `Test ${tag}` } });
  ids.inst = inst.id;
  const mk = async (name: string, data: { role: 'student' | 'staff'; status: 'invited' | 'active'; studentIdNo?: string }) =>
    (ids[name] = (await db.user.create({ data: { institutionId: inst.id, name, email: email(name), ...data } })).id);
  await mk('teacher', { role: 'staff', status: 'active' });
  for (const s of ['stu1', 'stu2', 'stu3', 'stu4']) await mk(s, { role: 'student', status: 'invited', studentIdNo: `${s.toUpperCase()}-${tag}` });
  await mk('newstaff', { role: 'staff', status: 'invited' });
  const branch = await db.branch.create({ data: { institutionId: inst.id, code: tag, name: 'Test branch' } });
  classId = (
    await db.class.create({
      data: { institutionId: inst.id, branchId: branch.id, admissionYear: 2025, section: 'A', name: `CSE ${tag} · A`, classTeacherId: ids.teacher! },
    })
  ).id;
});

after(async () => {
  await db.invite.deleteMany({ where: { invitedById: ids.teacher } });
  await db.class.deleteMany({ where: { id: classId } });
  await db.user.deleteMany({ where: { institutionId: ids.inst } });
  await db.institution.deleteMany({ where: { id: ids.inst } });
  await db.$disconnect();
});

/** createInvite with console.log captured; returns the token from the printed link. */
const invite = async (t: TestContext, name: string, extra: { classId?: string; role?: 'student' | 'staff' } = {}) => {
  const log = t.mock.method(console, 'log', () => {});
  try {
    await createInvite({ email: email(name).toUpperCase(), role: extra.role ?? 'student', invitedById: ids.teacher!, ...extra });
    const printed = String(log.mock.calls.at(-1)?.arguments[0]);
    return { printed, token: printed.match(/\/invite\/(\S+)/)?.[1] ?? '' };
  } finally {
    log.mock.restore();
  }
};

const accept = (token: string, body: object = {}) => request(app).post(`/api/v1/auth/invite/${token}/accept`).send({ password: PW, ...body });

test('student invite → link in the log → read-only fields → accept logs in (cookie) → reuse 410', async (t) => {
  const { printed, token } = await invite(t, 'stu1', { classId });
  assert.ok(token);
  assert.match(printed, new RegExp(`to=${email('stu1')} subject="Your class CSE ${tag} · A is on Digital Campus"`));
  assert.ok(printed.includes(`${config.APP_URL}/invite/${token}`));
  const row = await db.invite.findFirstOrThrow({ where: { email: email('stu1') } });
  assert.equal(row.email, email('stu1')); // lowercased
  assert.notEqual(row.tokenHash, token);
  assert.ok(Math.abs(row.expiresAt.getTime() - Date.now() - 14 * 86_400_000) < 60_000);

  const info = await request(app).get(`/api/v1/auth/invite/${token}`).expect(200);
  assert.deepEqual(info.body, { email: email('stu1'), studentIdNo: `STU1-${tag}`, className: `CSE ${tag} · A`, invitedBy: 'teacher' });

  await accept(token, { password: 'short' }).expect(422);
  const res = await accept(token, { name: 'Asha Rao' }).expect(200);
  assert.equal(res.body.user.name, 'Asha Rao');
  assert.equal(res.body.token, undefined);
  const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('dc_session='))!.split(';')[0]!;
  assert.equal((await request(app).get('/api/v1/auth/me').set('cookie', cookie).expect(200)).body.user.email, email('stu1'));
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: ids.stu1! } })).status, 'active');

  assert.equal((await accept(token).expect(410)).body.error.code, 'INVITE_EXPIRED');
  await request(app).get(`/api/v1/auth/invite/${token}`).expect(410);
  await request(app).post('/api/v1/auth/login').send({ email: email('stu1'), password: PW }).expect(200);
  // One account per email: re-inviting an active user is refused.
  await assert.rejects(createInvite({ email: email('stu1'), role: 'student', invitedById: ids.teacher! }), { status: 409, code: 'ACCOUNT_EXISTS' });
});

test('staff invite: no class → staff copy; client "app" gets a Bearer token', async (t) => {
  const { printed, token } = await invite(t, 'newstaff', { role: 'staff' });
  assert.match(printed, /subject="You are invited to Digital Campus"/);
  assert.deepEqual((await request(app).get(`/api/v1/auth/invite/${token}`).expect(200)).body, { email: email('newstaff'), invitedBy: 'teacher' });
  const res = await accept(token, { client: 'app' }).expect(200);
  assert.equal(res.headers['set-cookie'], undefined);
  await request(app).get('/api/v1/auth/me').auth(res.body.token, { type: 'bearer' }).expect(200);
});

test('expired or unknown token → 410', async (t) => {
  const { token } = await invite(t, 'stu2');
  await db.invite.updateMany({ where: { email: email('stu2') }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await request(app).get(`/api/v1/auth/invite/${token}`).expect(410);
  await accept(token).expect(410);
  await accept('not-a-token').expect(410);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: ids.stu2! } })).status, 'invited');
});

test('resend replaces the token: the old link is dead, the new one works', async (t) => {
  const first = await invite(t, 'stu3');
  const second = await invite(t, 'stu3');
  assert.notEqual(first.token, second.token);
  assert.equal(await db.invite.count({ where: { email: email('stu3') } }), 1);
  await accept(first.token).expect(410);
  await accept(second.token).expect(200);
});

test('two concurrent accepts of one invite: exactly one wins, the other gets 410', async (t) => {
  const { token } = await invite(t, 'stu4');
  const codes = (await Promise.all([accept(token), accept(token), accept(token)])).map((r) => r.status).sort();
  assert.deepEqual(codes, [200, 410, 410]);
  assert.equal(await db.loginSession.count({ where: { userId: ids.stu4! } }), 1);
});

test('createInvite without the invited User is a caller bug', async () => {
  await assert.rejects(createInvite({ email: email('ghost'), role: 'student', invitedById: ids.teacher! }), /create the invited User/);
});

test('mail: no SMTP in production → refuses and logs nothing', async (t) => {
  const log = t.mock.method(console, 'log', () => {});
  const env = config.NODE_ENV;
  config.NODE_ENV = 'production';
  try {
    await assert.rejects(sendMail('x@test.local', 'Secret', 'token=abc'), /refusing/);
    assert.equal(log.mock.callCount(), 0);
  } finally {
    config.NODE_ENV = env;
  }
});
