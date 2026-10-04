import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import request from 'supertest';
import { app } from '../src/app.js';
import { addDays, today } from '../src/lib/dates.js';
import { db } from '../src/lib/db.js';
import { attendanceSummary } from '../src/modules/attendance/math.js';
import { agent, resetDb } from './helpers.js';

// Seed: c1 (min 75%) has sub1 Data Structures (t1 Meera, class teacher) and sub2 Discrete Maths (t2 Arjun);
// 12 saved sessions per subject, every 3 days, none today or yesterday. s1 Riya is c1's CR.
before(resetDb);
after(() => db.$disconnect());

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const TODAY = ymd(today());
const URL = '/api/v1/attendance-sessions';

const classView = (token: string, classId: string, subjectId: string) =>
  request(app).get(`/api/v1/classes/${classId}/attendance?subjectId=${subjectId}`).auth(token, { type: 'bearer' });

test('attendanceSummary: the PROTO cases', () => {
  assert.deepEqual(attendanceSummary(0, 0, 75), { pct: 100, status: 'safe', text: 'Right at the line' }); // 0 sessions → 100%
  assert.deepEqual(attendanceSummary(3, 4, 75), { pct: 75, status: 'warn', text: 'Right at the line' }); // at the minimum
  assert.deepEqual(attendanceSummary(10, 13, 75), { pct: 77, status: 'warn', text: 'Right at the line' }); // above, but no margin
  assert.deepEqual(attendanceSummary(10, 12, 75), { pct: 83, status: 'safe', text: 'Safe by 1 class' });
  assert.deepEqual(attendanceSummary(9, 10, 75), { pct: 90, status: 'safe', text: 'Safe by 2 classes' });
  assert.deepEqual(attendanceSummary(6, 10, 75), { pct: 60, status: 'danger', text: 'Attend the next 6' }); // below
  assert.deepEqual(attendanceSummary(9, 13, 75), { pct: 69, status: 'danger', text: 'Attend the next 3' });
});

test('GET /me/attendance: my own subjects only; Riya\'s DS = "Safe by 4 classes"; staff → 403', async () => {
  const riya = await agent('student');
  const items = (await riya.get('/api/v1/me/attendance').expect(200)).body.items;
  assert.deepEqual(items.map((i: { subject: { id: string } }) => i.subject.id), ['sub1', 'sub2', 'sub3', 'sub4', 'sub5']);
  const ds = items[0];
  assert.equal(ds.text, 'Safe by 4 classes');
  assert.equal(ds.min, 75);
  assert.equal(ds.total, 12);
  assert.equal(ds.history.length, 12);
  assert.equal(ds.present, ds.history.filter((h: { present: boolean }) => h.present).length);
  const rows = await db.attendance.count({ where: { studentId: 's1', session: { subjectId: 'sub1' }, present: true } });
  assert.equal(ds.present, rows);
  await (await agent('teacher')).get('/api/v1/me/attendance').expect(403);
});

test('the CR and other students → 403 on every session route; teachers only for their own subjects', async () => {
  const body = { subjectId: 'sub2', date: TODAY };
  const s2 = (await db.user.findUniqueOrThrow({ where: { id: 's2' } })).email;
  for (const a of [await agent('cr'), await agent(s2)]) {
    await a.post(URL).send(body).expect(403);
    await a.put(`${URL}/se-sub2-1`).send({ absentIds: [] }).expect(403);
    await a.post(`${URL}/se-sub2-1/code`).expect(403);
    await classView(a.token, 'c1', 'sub2').expect(403);
  }
  await (await agent('subjectTeacher')).post(URL).send({ subjectId: 'sub1', date: TODAY }).expect(403); // Meera's subject
  await (await agent('outsider')).post(URL).send(body).expect(403); // Sana teaches c1, not sub2
  const meera = await agent('teacher'); // the class teacher: every subject
  await meera.post(URL).send(body).expect(200);
  await meera.post(URL).send({ ...body, date: ymd(addDays(today(), -2)) }).expect(403);
  await meera.post(URL).send({ ...body, date: ymd(addDays(today(), 1)) }).expect(422);
  await meera.post(URL).send({ ...body, slotId: 'tt0' }).expect(422); // tt0 is sub1's slot
});

test('roll: open is idempotent, save upserts everyone, a correction is audited before/after', async () => {
  const arjun = await agent('subjectTeacher');
  const yesterday = ymd(addDays(today(), -1)); // paper day
  const open = () => arjun.post(URL).send({ subjectId: 'sub2', date: yesterday }).expect(200);
  const [{ body: opened }, twin] = await Promise.all([open(), open()]); // a double tap
  assert.equal(twin.body.id, opened.id);
  assert.equal((await open()).body.id, opened.id);
  const active = await db.classMember.count({ where: { classId: 'c1', role: { in: ['student', 'cr'] }, user: { status: 'active' } } });
  assert.equal(opened.roster.length, active);
  assert.deepEqual(opened.absentIds, []);
  assert.equal(opened.roster.find((r: { id: string }) => r.id === 's1').rollNo, '001');

  await arjun.put(`${URL}/${opened.id}`).send({ absentIds: ['nobody'] }).expect(422);
  const saved = (await arjun.put(`${URL}/${opened.id}`).send({ absentIds: ['s2'] }).expect(200)).body;
  assert.deepEqual(saved.absentIds, ['s2']);
  assert.ok(saved.savedAt);
  assert.equal(await db.attendance.count({ where: { sessionId: opened.id } }), active);
  assert.equal(await db.auditLog.count({ where: { targetId: opened.id } }), 0); // first save isn't a correction

  await arjun.put(`${URL}/${opened.id}`).send({ absentIds: ['s3'] }).expect(200);
  const log = await db.auditLog.findFirstOrThrow({ where: { targetId: opened.id } });
  assert.deepEqual([log.action, log.actorId, log.classId, log.before, log.after], ['attendance.correct', 't2', 'c1', { absentIds: ['s2'] }, { absentIds: ['s3'] }]);
  assert.equal((await db.attendance.findFirstOrThrow({ where: { sessionId: opened.id, studentId: 's2' } })).present, true);
});

test('older sessions: the teacher → 403, the admin corrects them (audited)', async () => {
  await (await agent('teacher')).put(`${URL}/se-sub1-1`).send({ absentIds: [] }).expect(403);
  const admin = await agent('admin');
  const before = (await db.attendance.findMany({ where: { sessionId: 'se-sub1-1', present: false }, select: { studentId: true } })).map((r) => r.studentId);
  await admin.put(`${URL}/se-sub1-1`).send({ absentIds: [] }).expect(200);
  const log = await db.auditLog.findFirstOrThrow({ where: { targetId: 'se-sub1-1' } });
  assert.deepEqual([log.actorId, log.before, log.after], ['a1', { absentIds: before }, { absentIds: [] }]);
});

test('a student who drops below the minimum is notified, once', async () => {
  // s4 at exactly 9/12 = 75% in Database Systems (sub3, t4); one absence today → 9/13 = 69%.
  const sessions = (await db.attendanceSession.findMany({ where: { subjectId: 'sub3' }, select: { id: true }, orderBy: { date: 'asc' } })).map((s) => s.id);
  await db.attendance.updateMany({ where: { studentId: 's4', sessionId: { in: sessions } }, data: { present: true } });
  await db.attendance.updateMany({ where: { studentId: 's4', sessionId: { in: sessions.slice(0, 3) } }, data: { present: false } });
  const david = await agent('david.mathew@demo.edu');
  const s = (await david.post(URL).send({ subjectId: 'sub3', date: TODAY }).expect(200)).body;
  await david.put(`${URL}/${s.id}`).send({ absentIds: ['s4'] }).expect(200);
  await david.put(`${URL}/${s.id}`).send({ absentIds: ['s4', 's6'] }).expect(200);
  const notes = await db.notification.findMany({ where: { userId: 's4', type: 'attendance-low' } });
  assert.equal(notes.length, 1);
  assert.deepEqual(notes[0]!.payload, { subjectId: 'sub3', subjectName: 'Database Systems', classId: 'c1', pct: 69, min: 75, text: 'Attend the next 3' });
});

test('GET /classes/:id/attendance: lowest first, belowCount; history outlives membership', async () => {
  const arjun = await agent('subjectTeacher');
  await db.classMember.deleteMany({ where: { classId: 'c1', userId: 's5' } }); // AD-01: a deleted student loses ClassMember
  const body = (await classView(arjun.token, 'c1', 'sub2').expect(200)).body;
  const pcts = body.rows.map((r: { pct: number }) => r.pct);
  assert.deepEqual(pcts, [...pcts].sort((a, b) => a - b));
  assert.equal(body.belowCount, pcts.filter((p: number) => p < 75).length);
  assert.ok(body.belowCount > 0);
  assert.ok(body.rows.some((r: { student: { id: string } }) => r.student.id === 's5'));
  await classView(arjun.token, 'c1', 'sub1').expect(403); // not his subject
  await classView((await agent('teacher')).token, 'c1', 'sub2').expect(200); // class teacher
  await classView(arjun.token, 'c1', 'sub6').expect(404); // c2's subject
});
