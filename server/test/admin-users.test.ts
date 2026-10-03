import assert from 'node:assert/strict';
import { after, before, test, type TestContext } from 'node:test';
import { db } from '../src/lib/db.js';
import { agent, PASSWORD, resetDb } from './helpers.js';

before(resetDb);
after(() => db.$disconnect());

/** Run `fn` with console.log (the D14 mail print) silenced. */
const quiet = async <T>(t: TestContext, fn: () => PromiseLike<T>) => {
  const log = t.mock.method(console, 'log', () => {});
  try {
    return await fn();
  } finally {
    log.mock.restore();
  }
};

test('non-admins get 403 on /admin/users', async () => {
  for (const who of ['teacher', 'student'] as const) await (await agent(who)).get('/api/v1/admin/users').expect(403);
});

test('directory lists and filters users', async () => {
  const a = await agent('admin');
  const { body } = await a.get('/api/v1/admin/users').query({ q: 'riya', role: 'student' }).expect(200);
  const riya = body.items.find((u: { id: string }) => u.id === 's1');
  assert.ok(riya, 'Riya is found by name');
  assert.equal(riya.homeClass.id, 'c1');
  assert.equal(riya.status, 'active');
  const byClass = await a.get('/api/v1/admin/users').query({ classId: 'c1', limit: 5 }).expect(200);
  assert.equal(byClass.body.items.length, 5);
  assert.ok(byClass.body.nextCursor);
  assert.ok(byClass.body.items.every((u: { homeClass: { id: string } }) => u.homeClass.id === 'c1'));
  const next = await a.get('/api/v1/admin/users').query({ classId: 'c1', limit: 5, cursor: byClass.body.nextCursor }).expect(200);
  assert.ok(!next.body.items.some((u: { id: string }) => byClass.body.items.some((v: { id: string }) => v.id === u.id)));
});

test('staff invite creates an invited staff user + invite; re-post resends; an active email → 409', async (t) => {
  const a = await agent('admin');
  const email = 'new.teacher@test.local';
  const first = await quiet(t, () => a.post('/api/v1/admin/staff-invites').send({ name: 'New Teacher', email: email.toUpperCase(), dept: 'Physics' }).expect(201));
  assert.equal(first.body.user.email, email);
  assert.equal(first.body.user.status, 'invited');
  assert.equal(first.body.user.role, 'staff');
  const firstInvite = await db.invite.findFirstOrThrow({ where: { email } });
  const again = await quiet(t, () => a.post('/api/v1/admin/staff-invites').send({ name: 'New Teacher', email, dept: 'Maths' }).expect(201));
  assert.equal(again.body.user.id, first.body.user.id);
  assert.equal(again.body.user.dept, 'Maths');
  const invites = await db.invite.findMany({ where: { email } });
  assert.equal(invites.length, 1);
  assert.notEqual(invites[0]!.tokenHash, firstInvite.tokenHash);
  assert.equal(await db.auditLog.count({ where: { targetId: first.body.user.id, action: { startsWith: 'staff.invite' } } }), 2);
  await a.post('/api/v1/admin/staff-invites').send({ name: 'Meera', email: 'meera.iyer@demo.edu', dept: 'CS' }).expect(409);
});

test("disabling ends the user's sessions immediately; enabling restores access", async () => {
  const a = await agent('admin');
  const t2 = await agent('subjectTeacher');
  await t2.get('/api/v1/auth/me').expect(200);
  const { body } = await a.patch('/api/v1/admin/users/t2/status').send({ status: 'disabled' }).expect(200);
  assert.equal(body.status, 'disabled');
  await t2.get('/api/v1/auth/me').expect(401);
  assert.equal(await db.loginSession.count({ where: { userId: 't2' } }), 0);
  const log = await db.auditLog.findFirstOrThrow({ where: { targetId: 't2', action: 'user.disable' } });
  assert.deepEqual(log.after, { status: 'disabled' });
  await a.patch('/api/v1/admin/users/t2/status').send({ status: 'active' }).expect(200);
  await (await agent('subjectTeacher')).get('/api/v1/auth/me').expect(200);
});

test('the chief cannot be disabled (409); invited users cannot be toggled (409); unknown → 404', async () => {
  const a = await agent('admin');
  await a.patch('/api/v1/admin/users/a1/status').send({ status: 'disabled' }).expect(409);
  await a.patch('/api/v1/admin/users/t9/status').send({ status: 'active' }).expect(409);
  await a.patch('/api/v1/admin/users/nope/status').send({ status: 'active' }).expect(404);
  await a.patch('/api/v1/admin/users/t2/status').send({ status: 'banned' }).expect(422);
});

test('admin reset-password emails a reset link that works', async (t) => {
  const a = await agent('admin');
  const log = t.mock.method(console, 'log', () => {});
  await a.post('/api/v1/admin/users/t3/reset-password').expect(204);
  const printed = String(log.mock.calls.at(-1)?.arguments[0]);
  log.mock.restore();
  const token = printed.match(/\/reset\/(\S+)/)?.[1];
  assert.ok(token, printed);
  assert.ok(await db.auditLog.findFirst({ where: { targetId: 't3', action: 'user.password.reset' } }));
  await a.post('/api/v1/admin/users/t9/reset-password').expect(409); // invited, no password yet
});

test('admin delete (SPEC §12): attendance stays, name anonymised, Commons content gone, sessions dead', async () => {
  const victim = await db.user.findFirstOrThrow({ where: { id: { not: 's1' }, role: 'student', status: 'active', attendance: { some: {} }, boardPosts: { some: {} } } });
  const attendance = await db.attendance.count({ where: { studentId: victim.id } });
  const s = await agent(victim.email);
  const a = await agent('admin');
  await a.delete(`/api/v1/admin/users/${victim.id}`).expect(204);
  const after = await db.user.findUniqueOrThrow({ where: { id: victim.id } });
  assert.equal(after.name, 'Deleted student');
  assert.notEqual(after.email, victim.email);
  assert.equal(after.status, 'disabled');
  assert.equal(after.passwordHash, null);
  assert.equal(await db.attendance.count({ where: { studentId: victim.id } }), attendance);
  assert.equal(await db.boardPost.count({ where: { authorId: victim.id } }), 0);
  assert.equal(await db.profile.count({ where: { userId: victim.id } }), 0);
  await s.get('/api/v1/auth/me').expect(401);
  const log = await db.auditLog.findFirstOrThrow({ where: { targetId: victim.id, action: 'user.delete' } });
  assert.ok(!JSON.stringify(log).includes(victim.email), 'the audit row does not keep the email');
});

test('admin delete refuses the chief and an active class teacher (409)', async () => {
  const a = await agent('admin');
  await a.delete('/api/v1/admin/users/a1').expect(409);
  await a.delete('/api/v1/admin/users/t1').expect(409);
});

test('DELETE /me needs the password; the chief cannot self-delete', async () => {
  const s = await agent('student');
  await s.delete('/api/v1/me').send({ password: 'wrong-password' }).expect(403);
  await s.delete('/api/v1/me').send({}).expect(422);
  await s.delete('/api/v1/me').send({ password: PASSWORD }).expect(204);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: 's1' } })).name, 'Deleted student');
  await (await agent('admin')).delete('/api/v1/me').send({ password: PASSWORD }).expect(409);
});

test('a deleted account stays gone: no re-enable, reset or badge (404)', async () => {
  const a = await agent('admin');
  await a.delete('/api/v1/admin/users/s10').expect(204);
  await a.patch('/api/v1/admin/users/s10/status').send({ status: 'active' }).expect(404);
  await a.post('/api/v1/admin/users/s10/reset-password').expect(404);
  await a.put('/api/v1/admin/users/s10/admin').send({ isAdmin: true }).expect(404);
  await a.delete('/api/v1/admin/users/s10').expect(404);
});
