import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

// Seed: thin class c-cse1 (CSE 1st year) has a CR and no subjects; Arjun (t2) isn't on it. c1's sub1 has attendance.
before(resetDb);
after(() => db.$disconnect());

const studentOf = async (classId: string, role: 'cr' | 'student') =>
  agent((await db.classMember.findFirstOrThrow({ where: { classId, role, user: { status: 'active' } }, include: { user: true } })).user.email);
const ids = (body: { items: { id: string }[] }) => body.items.map((c) => c.id);

test('GET /staff: active staff for anyone logged in, no emails', async () => {
  const s1 = await agent('student');
  const all = (await s1.get('/api/v1/staff?limit=100').expect(200)).body.items;
  assert.ok(all.some((p: { name: string }) => p.name === 'Prof. Arjun Rao'));
  assert.ok(!all.some((p: { id: string }) => ['t0', 't8', 't9'].includes(p.id))); // disabled, invited
  assert.ok(all.every((p: object) => !('email' in p)));
  assert.deepEqual(ids((await s1.get('/api/v1/staff?q=arJUN').expect(200)).body), ['t2']);
  assert.deepEqual(ids((await s1.get('/api/v1/staff?q=physics').expect(200)).body), ['t3']);
  await request(app).get('/api/v1/staff').expect(401);
});

test('the CR allots Arjun; he sees the class and is notified; "Not me" undoes it and tells the CR', async () => {
  const cr = await studentOf('c-cse1', 'cr');
  const t2 = await agent('subjectTeacher');
  const url = '/api/v1/classes/c-cse1/subjects';
  await (await studentOf('c-cse1', 'student')).post(url).send({ name: 'Calculus', teacherId: 't2' }).expect(403);
  await cr.post(url).send({ name: 'Calculus', teacherId: 't0' }).expect(422); // disabled staff
  await cr.post(url).send({ name: 'Calculus', teacherId: 's1' }).expect(422); // a student

  const sub = (await cr.post(url).send({ name: 'Calculus', code: 'MA101', teacherId: 't2' }).expect(201)).body;
  assert.deepEqual(sub.teacher, { id: 't2', name: 'Prof. Arjun Rao' });
  assert.ok(ids((await t2.get('/api/v1/classes').expect(200)).body).includes('c-cse1'));
  const n = await db.notification.findFirstOrThrow({ where: { userId: 't2', type: 'subject-allotted' } });
  assert.deepEqual([(n.payload as { subjectId: string }).subjectId, (n.payload as { by: string }).by], [sub.id, cr.user.id]);
  assert.deepEqual(ids((await cr.get(url).expect(200)).body), [sub.id]);

  await cr.post(`${url}/${sub.id}/decline`).expect(403); // only the allotted teacher
  await t2.post(`${url}/${sub.id}/decline`).expect(204);
  assert.ok(!ids((await t2.get('/api/v1/classes').expect(200)).body).includes('c-cse1'));
  await t2.get('/api/v1/classes/c-cse1').expect(403);
  assert.equal((await cr.get(url).expect(200)).body.items[0].teacher, null);
  assert.ok(await db.notification.findFirst({ where: { userId: cr.user.id, type: 'subject-declined' } }));
  assert.equal(await db.auditLog.count({ where: { action: 'subject.decline', classId: 'c-cse1' } }), 1);
});

test('PATCH re-allots (the old teacher leaves when idle); DELETE drops the membership; attendance blocks DELETE', async () => {
  const cr = await studentOf('c-cse1', 'cr');
  const url = '/api/v1/classes/c-cse1/subjects';
  const sub = (await cr.post(url).send({ name: 'Physics', teacherId: 't3' }).expect(201)).body;
  const member = (userId: string) => db.classMember.findFirst({ where: { classId: 'c-cse1', userId, role: 'teacher' } });
  assert.ok(await member('t3'));
  const moved = (await cr.patch(`${url}/${sub.id}`).send({ teacherId: 't4', code: 'PH101' }).expect(200)).body;
  assert.deepEqual([moved.teacher.id, moved.code], ['t4', 'PH101']);
  assert.equal(await member('t3'), null);
  assert.ok(await db.notification.findFirst({ where: { userId: 't4', type: 'subject-allotted' } }));
  await cr.delete(`${url}/${sub.id}`).expect(204);
  assert.equal(await member('t4'), null);
  await cr.delete(`${url}/${sub.id}`).expect(404);

  await (await agent('cr')).delete('/api/v1/classes/c1/subjects/sub1').expect(409);
  await (await agent('subjectTeacher')).delete('/api/v1/classes/c1/subjects/sub2').expect(403); // teaches, not board
});
