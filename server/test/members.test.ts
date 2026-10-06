import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

// Seed: c1 class teacher t1, CR s1, students s1..s30 (s29, s30 invited). t2 teaches c1 but doesn't own it.
before(resetDb);
after(() => db.$disconnect());

// PROTO teacher.html:151 SAMPLE, split like parseList, plus a header row.
const SAMPLE = ['ID, email', '25ME001, ananya.s@students.demo.edu', '25ME002, rahul.k@students.demo.edu', '25ME003, sara.m@students.demo.edu', '25ME004, dev.p@students.demo.edu', '25ME005, ira.n@students.demo.edu', '25ME006, kabir.t@students.demo.edu', '25ME002, rahul.dup@students.demo.edu', '25ME007, not-an-email'];
const rows = SAMPLE.map((l) => l.split(/[,;\t\s]+/)).map(([studentIdNo, email]) => ({ studentIdNo, email }));
const url = '/api/v1/classes/c1';

test('invites: dry-run preview matches PROTO, only the class teacher may invite, then invited accounts are created', async () => {
  const t1 = await agent('teacher');
  const pre = (await t1.post(`${url}/invites`).send({ rows, dryRun: true }).expect(200)).body;
  assert.deepEqual([pre.ready, pre.dup, pre.bad], [6, 1, 1]);
  assert.equal(pre.rows.length, 8);
  assert.equal(pre.rows[6].issue, 'Duplicate');
  assert.equal(pre.rows[7].issue, 'Bad email');

  // Against the DB: a seeded ID (any case) and a seeded email.
  const s2 = await db.user.findUniqueOrThrow({ where: { id: 's2' } });
  const dupe = (await t1.post(`${url}/invites`).send({ rows: [{ studentIdNo: s2.studentIdNo!.toLowerCase(), email: 'a@b.co' }, { studentIdNo: 'X1', email: s2.email.toUpperCase() }] }).expect(200)).body;
  assert.deepEqual([dupe.ready, dupe.dup], [0, 2]);

  for (const who of ['subjectTeacher', 'student'] as const) await (await agent(who)).post(`${url}/invites`).send({ rows, dryRun: true }).expect(403);

  const made = (await t1.post(`${url}/invites`).send({ rows, dryRun: false }).expect(201)).body;
  assert.equal(made.ready, 6);
  const ananya = await db.user.findUniqueOrThrow({ where: { email: 'ananya.s@students.demo.edu' }, include: { memberships: true, profile: true } });
  assert.equal(ananya.status, 'invited');
  assert.equal(ananya.homeClassId, 'c1');
  assert.equal(ananya.studentIdNo, '25ME001');
  assert.deepEqual(ananya.memberships.map((m) => [m.classId, m.role]), [['c1', 'student']]);
  assert.ok(ananya.profile);
  assert.equal(await db.invite.count({ where: { email: ananya.email, classId: 'c1', acceptedAt: null } }), 1);
  assert.equal(await db.auditLog.count({ where: { action: 'class.invite', classId: 'c1' } }), 1);
  // Pasting the same list again: all of them are duplicates now.
  assert.equal((await t1.post(`${url}/invites`).send({ rows, dryRun: true }).expect(200)).body.dup, 7);

  const old = await db.invite.findFirstOrThrow({ where: { email: ananya.email } });
  await t1.post(`${url}/invites/resend`).send({ userId: ananya.id }).expect(200);
  const fresh = await db.invite.findFirstOrThrow({ where: { email: ananya.email } });
  assert.notEqual(fresh.tokenHash, old.tokenHash);
  await t1.post(`${url}/invites/resend`).send({ userId: 's2' }).expect(409); // already active
  await t1.post(`${url}/invites/resend`).send({ userId: 's31' }).expect(404); // c2's student
});

test('roster: students see names only, staff see IDs and emails', async () => {
  const mine = (await (await agent('student')).get(`${url}/members`).expect(200)).body.items;
  assert.ok(mine.length >= 30);
  assert.ok(mine.every((m: object) => !('email' in m) && !('studentIdNo' in m)));
  assert.equal(mine.find((m: { id: string }) => m.id === 's1').isCR, true);
  const staff = (await (await agent('subjectTeacher')).get(`${url}/members`).expect(200)).body.items;
  assert.ok(staff.every((m: { email?: string }) => m.email));
  await (await agent('outsider')).get('/api/v1/classes/c2/members').expect(403);
});

test('CR: 1–2 active or invited students; old and new CRs are notified', async () => {
  const t1 = await agent('teacher');
  await (await agent('cr')).put(`${url}/cr`).send({ userIds: ['s2'] }).expect(403);
  await t1.put(`${url}/cr`).send({ userIds: ['s31'] }).expect(422); // another class
  await t1.put(`${url}/cr`).send({ userIds: ['s1', 's2', 's3'] }).expect(422);

  const both = (await t1.put(`${url}/cr`).send({ userIds: ['s1', 's2'] }).expect(200)).body.items;
  assert.deepEqual(both.filter((m: { isCR: boolean }) => m.isCR).map((m: { id: string }) => m.id).sort(), ['s1', 's2']);
  const n2 = await db.notification.findFirstOrThrow({ where: { userId: 's2', type: 'class-cr' } });
  assert.match((n2.payload as { text: string }).text, /You are now the CR of CSE · 2nd year · A/);
  assert.equal(await db.notification.count({ where: { userId: 's1', type: 'class-cr' } }), 0); // unchanged

  await t1.put(`${url}/cr`).send({ userIds: ['s2'] }).expect(200);
  const n1 = await db.notification.findFirstOrThrow({ where: { userId: 's1', type: 'class-cr' } });
  assert.match((n1.payload as { text: string }).text, /no longer the CR/);
  assert.equal(await db.auditLog.count({ where: { action: 'class.cr', classId: 'c1' } }), 2);

  // D17: an invited student may be CR (the new-class wizard picks one before anyone has joined); disabled may not.
  await t1.put(`${url}/cr`).send({ userIds: ['s30'] }).expect(200);
  await db.user.update({ where: { id: 's29' }, data: { status: 'disabled' } });
  await t1.put(`${url}/cr`).send({ userIds: ['s29'] }).expect(422);
});

test('remove: the student loses class access but keeps the account and profile', async () => {
  const t1 = await agent('teacher');
  const s3 = await agent((await db.user.findUniqueOrThrow({ where: { id: 's3' } })).email);
  await s3.get(`${url}`).expect(200);
  await (await agent('subjectTeacher')).delete(`${url}/members/s3`).expect(403);
  await t1.delete(`${url}/members/s3`).expect(204);
  await s3.get(`${url}`).expect(403);
  await t1.delete(`${url}/members/s3`).expect(404);
  await t1.delete(`${url}/members/t2`).expect(404); // teachers leave via subjects (CS-03)
  const user = await db.user.findUniqueOrThrow({ where: { id: 's3' }, include: { profile: true } });
  assert.equal(user.status, 'active');
  assert.ok(user.profile);

  // An invited student's pending link dies with the membership.
  await t1.delete(`${url}/members/s30`).expect(204);
  assert.equal(await db.invite.count({ where: { email: (await db.user.findUniqueOrThrow({ where: { id: 's30' } })).email, acceptedAt: null } }), 0);
});
