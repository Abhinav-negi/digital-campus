import assert from 'node:assert/strict';
import { after, before, test, type TestContext } from 'node:test';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

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

const activeIn = (classId: string) => db.user.findFirstOrThrow({ where: { homeClassId: classId, status: 'active', role: 'student', id: { not: 's1' } }, orderBy: { id: 'asc' } });

test('non-admins get 403', async () => {
  for (const who of ['teacher', 'student'] as const) {
    const a = await agent(who);
    await a.patch('/api/v1/admin/students/s1').send({ name: 'X' }).expect(403);
    await a.post('/api/v1/admin/students/s1/move').send({ classId: 'c2' }).expect(403);
  }
});

test('edit details: lowercased email, audited before/after, student notified; a taken email → 409; staff/unknown/deleted → 404', async () => {
  const a = await agent('admin');
  const s = await activeIn('c1');
  const { body } = await a.patch(`/api/v1/admin/students/${s.id}`).send({ name: 'New Name', studentIdNo: 'NEW-01', email: 'New.Mail@Test.Local' }).expect(200);
  assert.equal(body.name, 'New Name');
  assert.equal(body.studentIdNo, 'NEW-01');
  assert.equal(body.email, 'new.mail@test.local');
  const log = await db.auditLog.findFirstOrThrow({ where: { action: 'student.update', targetId: s.id } });
  assert.deepEqual(log.before, { name: s.name, studentIdNo: s.studentIdNo, email: s.email });
  assert.deepEqual(log.after, { name: 'New Name', studentIdNo: 'NEW-01', email: 'new.mail@test.local' });
  assert.equal(await db.notification.count({ where: { userId: s.id, type: 'account-update' } }), 1);

  const riya = await db.user.findUniqueOrThrow({ where: { id: 's1' } });
  await a.patch(`/api/v1/admin/students/${s.id}`).send({ email: riya.email.toUpperCase() }).expect(409);
  await a.patch('/api/v1/admin/students/t1').send({ name: 'X' }).expect(404);
  await a.patch('/api/v1/admin/students/nope').send({ name: 'X' }).expect(404);
  const gone = await activeIn('c3');
  await a.delete(`/api/v1/admin/users/${gone.id}`).expect(204);
  await a.patch(`/api/v1/admin/students/${gone.id}`).send({ name: 'Back' }).expect(404);
  await a.post(`/api/v1/admin/students/${gone.id}/move`).send({ classId: 'c2' }).expect(404);
});

test("a new email on an invited student re-sends the invite to it", async (t) => {
  const a = await agent('admin');
  const s = await db.user.findFirstOrThrow({ where: { homeClassId: 'c1', status: 'invited' } });
  assert.equal(await db.invite.count({ where: { email: s.email, acceptedAt: null } }), 1);
  await quiet(t, () => a.patch(`/api/v1/admin/students/${s.id}`).send({ email: 'fixed.typo@test.local' }).expect(200));
  assert.equal(await db.invite.count({ where: { email: s.email } }), 0);
  const inv = await db.invite.findFirstOrThrow({ where: { email: 'fixed.typo@test.local', acceptedAt: null } });
  assert.equal(inv.classId, 'c1');
});

test('move batch: the student sees the new class and loses the old one; CR dropped; attendance kept; audited', async () => {
  const a = await agent('admin');
  const riya = await agent('student'); // s1, CR of c1
  const attendance = await db.attendance.count({ where: { studentId: 's1' } });
  assert.ok(attendance > 0, 'the seed gives Riya attendance history');
  const mine = async () => ((await riya.get('/api/v1/classes').expect(200)).body.items as { id: string }[]).map((c) => c.id);
  assert.deepEqual(await mine(), ['c1']);

  const { body } = await a.post('/api/v1/admin/students/s1/move').send({ classId: 'c2' }).expect(200);
  assert.deepEqual(body.homeClass, { id: 'c2', name: 'CSE · 2nd year · B' });
  assert.deepEqual(await mine(), ['c2']);
  await riya.get('/api/v1/classes/c1/members').expect(403);
  assert.equal(await db.classMember.count({ where: { classId: 'c1', userId: 's1' } }), 0);
  assert.equal((await db.classMember.findUniqueOrThrow({ where: { classId_userId: { classId: 'c2', userId: 's1' } } })).role, 'student');
  assert.equal(await db.attendance.count({ where: { studentId: 's1' } }), attendance);

  const log = await db.auditLog.findFirstOrThrow({ where: { action: 'student.move', targetId: 's1' } });
  assert.deepEqual(log.before, { classId: 'c1', class: 'CSE · 2nd year · A', role: 'cr' });
  assert.deepEqual(log.after, { classId: 'c2', class: 'CSE · 2nd year · B', role: 'student' });
  assert.equal(await db.notification.count({ where: { userId: 's1', type: 'class-move' } }), 1);

  await a.post('/api/v1/admin/students/s1/move').send({ classId: 'c2' }).expect(409);
  await a.post('/api/v1/admin/students/s1/move').send({ classId: 'nope' }).expect(404);
});
