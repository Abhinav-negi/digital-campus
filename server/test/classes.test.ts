import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { db } from '../src/lib/db.js';
import { className, semesterFor } from '../src/modules/classes/service.js';
import { agent, resetDb } from './helpers.js';

// Seed: c1 = CSE · 2nd year · A, semester 3, class teacher t1, CR s1, subjects taught by t2/t3. c3 = t3's class.
before(resetDb);
after(() => db.$disconnect());

const card = (body: { items: { id: string }[] }, id: string) => body.items.find((c) => c.id === id);

test('className + semesterFor', () => {
  assert.equal(className('CSE', 2, 'A'), 'CSE · 2nd year · A');
  assert.equal(className('ECE', 1, ''), 'ECE · 1st year');
  assert.equal(semesterFor(2025, new Date('2026-10-04')), 3);
  assert.equal(semesterFor(2025, new Date('2026-03-01')), 2);
  assert.equal(semesterFor(2026, new Date('2026-03-01')), 1);
  assert.equal(semesterFor(2010, new Date('2026-10-04')), 8);
});

test('GET /classes: my classes with term, counts, CRs and my role', async () => {
  const s1 = await agent('student');
  const res = await s1.get('/api/v1/classes').expect(200);
  const c1 = card(res.body, 'c1');
  assert.ok(c1);
  assert.equal(c1.name, 'CSE · 2nd year · A');
  assert.equal(c1.yearOfStudy, 2);
  assert.equal(c1.termLabel, 'Semester 3');
  assert.equal(c1.myRole, 'cr');
  assert.equal(c1.counts.students, 30);
  assert.ok(c1.counts.subjects > 0);
  assert.deepEqual(c1.crs.map((p: { name: string }) => p.name), ['Riya Patel']);

  const t2 = await agent('subjectTeacher');
  const mine = (await t2.get('/api/v1/classes?all=1').expect(200)).body; // ?all is admin-only, ignored here
  assert.deepEqual(mine.items.map((c: { id: string }) => c.id).sort(), ['c1', 'c2', 'c3']);
  assert.equal(card(mine, 'c1')!.myRole, 'teacher');

  const a1 = await agent('admin');
  assert.equal((await a1.get('/api/v1/classes').expect(200)).body.items.length, 0);
  const all = (await a1.get('/api/v1/classes?all=1&limit=100').expect(200)).body;
  assert.equal(all.items.length, 21);
  assert.equal(all.nextCursor, null);
  const p1 = (await a1.get('/api/v1/classes?all=1&limit=5').expect(200)).body;
  const p2 = (await a1.get(`/api/v1/classes?all=1&limit=5&cursor=${p1.nextCursor}`).expect(200)).body;
  assert.equal(p2.items.length, 5);
  assert.ok(!p2.items.some((c: { id: string }) => p1.items.some((d: { id: string }) => d.id === c.id)));
});

test('POST /classes: staff creates a class + Term 1 and becomes its class teacher; PATCH renames', async () => {
  const s1 = await agent('student');
  const body = { branchId: 'it', admissionYear: 2025, section: 'B', minAttendancePct: 80, semester: 3 };
  await s1.post('/api/v1/classes').send(body).expect(403);
  const t2 = await agent('subjectTeacher');
  await t2.post('/api/v1/classes').send({ ...body, branchId: 'nope' }).expect(404);
  const created = (await t2.post('/api/v1/classes').send(body).expect(201)).body;
  assert.equal(created.name, 'IT · 2nd year · B');
  assert.equal(created.semester, 3);
  assert.equal(created.myRole, 'classTeacher');
  assert.equal(created.minAttendancePct, 80);
  assert.equal((await t2.get(`/api/v1/classes/${created.id}/terms`).expect(200)).body.items.length, 1);

  const t1 = await agent('teacher');
  await t1.patch(`/api/v1/classes/${created.id}`).send({ section: 'C' }).expect(403);
  const patched = (await t2.patch(`/api/v1/classes/${created.id}`).send({ section: '', minAttendancePct: 70 }).expect(200)).body;
  assert.equal(patched.name, 'IT · 2nd year');
  assert.equal(patched.minAttendancePct, 70);

  const defaulted = (await t2.post('/api/v1/classes').send({ branchId: 'me', admissionYear: new Date().getUTCFullYear() }).expect(201)).body;
  assert.equal(defaulted.minAttendancePct, 75);
  assert.equal(defaulted.yearOfStudy, 1);
});

test('a subject teacher gets 403 on next / graduate / handover', async () => {
  const t2 = await agent('subjectTeacher');
  await t2.post('/api/v1/classes/c1/terms/next').expect(403);
  await t2.post('/api/v1/classes/c1/graduate').expect(403);
  await t2.post('/api/v1/classes/c1/handover').send({ teacherId: 't2' }).expect(403);
  await t2.post('/api/v1/classes/nope/terms/next').expect(404);
});

test('promotion carries members, closes the old term, increments the year label', async () => {
  const t1 = await agent('teacher');
  const members = await db.classMember.count({ where: { classId: 'c1', role: { in: ['student', 'cr'] } } });
  const oldTerm = await db.term.findFirstOrThrow({ where: { classId: 'c1', endedAt: null } });

  const sem4 = (await t1.post('/api/v1/classes/c1/terms/next').expect(200)).body;
  assert.equal(sem4.semester, 4);
  assert.equal(sem4.name, 'CSE · 2nd year · A');
  assert.equal(sem4.counts.students, members);
  assert.deepEqual(sem4.crs.map((p: { id: string }) => p.id), ['s1']);
  assert.ok((await db.term.findUniqueOrThrow({ where: { id: oldTerm.id } })).endedAt);

  // Past-term subjects are gone from active-term queries: none in the new term, and their teachers lose the class.
  assert.equal(sem4.counts.subjects, 0);
  assert.equal(await db.subject.count({ where: { classId: 'c1', term: { endedAt: null } } }), 0);
  const t3 = await agent('outsider');
  await t3.get('/api/v1/classes/c1').expect(403);
  assert.ok(!card((await t3.get('/api/v1/classes').expect(200)).body, 'c1'));

  const sem5 = (await t1.post('/api/v1/classes/c1/terms/next').expect(200)).body;
  assert.equal(sem5.yearOfStudy, 3);
  assert.equal(sem5.name, 'CSE · 3rd year · A');

  const terms = (await t1.get('/api/v1/classes/c1/terms').expect(200)).body.items;
  assert.deepEqual(terms.map((t: { semester: number }) => t.semester), [5, 4, 3]);
  assert.deepEqual(terms.map((t: { endedAt: string | null }) => t.endedAt === null), [true, false, false]);

  const s1 = await agent('student');
  assert.equal((await s1.get('/api/v1/classes/c1').expect(200)).body.myRole, 'cr');
  assert.equal(await db.notification.count({ where: { userId: 's1', type: 'class-term' } }), 2);
  assert.equal(await db.auditLog.count({ where: { classId: 'c1', action: 'class.term.next', actorId: 't1' } }), 2);

  await t1.post('/api/v1/classes/c1/graduate').expect(409); // semester 5 < 8
});

test('admin: next / handover / graduate → 200 + audit; graduated class is read-only except for the admin', async () => {
  const a1 = await agent('admin');
  assert.equal((await a1.post('/api/v1/classes/c2/terms/next').expect(200)).body.semester, 4);
  assert.equal(await db.auditLog.count({ where: { classId: 'c2', action: 'class.term.next', actorId: 'a1' } }), 1);

  await a1.post('/api/v1/classes/c2/handover').send({ teacherId: 's1' }).expect(422);
  const handed = (await a1.post('/api/v1/classes/c2/handover').send({ teacherId: 't1' }).expect(200)).body;
  assert.equal(handed.classTeacher.id, 't1');
  assert.equal(await db.auditLog.count({ where: { classId: 'c2', action: 'class.handover', actorId: 'a1' } }), 1);
  assert.equal(await db.notification.count({ where: { userId: { in: ['t1', 't4'] }, type: 'class-handover' } }), 2);
  await (await agent('david.mathew@demo.edu')).patch('/api/v1/classes/c2').send({ minAttendancePct: 60 }).expect(403);

  const grad = (await a1.post('/api/v1/classes/c1/graduate').expect(200)).body;
  assert.ok(grad.archivedAt);
  assert.equal(await db.term.count({ where: { classId: 'c1', endedAt: null } }), 0);
  assert.equal(await db.auditLog.count({ where: { classId: 'c1', action: 'class.graduate', actorId: 'a1' } }), 1);

  const t1 = await agent('teacher');
  await t1.get('/api/v1/classes/c1').expect(200);
  for (const res of [
    await t1.patch('/api/v1/classes/c1').send({ minAttendancePct: 60 }),
    await t1.post('/api/v1/classes/c1/terms/next'),
    await t1.post('/api/v1/classes/c1/handover').send({ teacherId: 't2' }),
  ]) {
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'ARCHIVED');
  }
  assert.equal((await a1.patch('/api/v1/classes/c1').send({ minAttendancePct: 60 }).expect(200)).body.minAttendancePct, 60);
  await a1.post('/api/v1/classes/c1/graduate').expect(409);
});

test('class teacher hands over to another teacher', async () => {
  const t3 = await agent('outsider');
  const res = (await t3.post('/api/v1/classes/c3/handover').send({ teacherId: 't2' }).expect(200)).body;
  assert.equal(res.myRole, 'teacher'); // still allotted a subject
  await t3.patch('/api/v1/classes/c3').send({ minAttendancePct: 60 }).expect(403);
  await (await agent('subjectTeacher')).patch('/api/v1/classes/c3').send({ minAttendancePct: 60 }).expect(200);
});

test('unbuilt sub-paths still 501', async () => {
  await (await agent('teacher')).get('/api/v1/classes/c3/board').expect(501);
});
