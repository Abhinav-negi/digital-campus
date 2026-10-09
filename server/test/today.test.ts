import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { addDays, dow, today } from '../src/lib/dates.js';
import { db } from '../src/lib/db.js';
import { codeAt } from '../src/modules/attendance/code.js';
import { agent, resetDb } from './helpers.js';

before(async () => {
  resetDb();
  // A known day whatever today's weekday: replace the whole timetable, changes, board, posts.
  const d = today();
  await db.$transaction([
    db.scheduleChange.deleteMany(),
    db.timetableSlot.deleteMany(), // all classes: t2 also teaches elsewhere (tt25 on Mondays)
    db.boardItem.deleteMany(),
    db.post.deleteMany(),
    db.reminder.deleteMany(),
  ]);
  const slot = (id: string, classId: string, subjectId: string, start: string, end: string) => ({ id, termId: `term-${classId}`, classId, subjectId, weekday: dow(d), start, end });
  await db.timetableSlot.createMany({
    data: [slot('sa', 'c1', 'sub2', '10:00', '11:00'), slot('sb', 'c2', 'sub7', '10:30', '11:30'), slot('sc', 'c1', 'sub1', '09:00', '10:00')], // t2 is in sa and sb at once
  });
  await db.scheduleChange.createMany({
    data: [
      { id: 'x1', classId: 'c1', termId: 'term-c1', date: d, slotId: 'sc', kind: 'cancelled', subjectId: 'sub1', authorId: 's1' },
      { id: 'x2', classId: 'c1', termId: 'term-c1', date: d, kind: 'extra', subjectId: 'sub3', start: '10:30', end: '11:30', authorId: 's1' }, // clashes with sa in c1
    ],
  });
  await db.attendanceSession.create({ data: { termId: 'term-c1', subjectId: 'sub2', slotId: 'sa', date: d, savedAt: new Date() } });
});
after(() => db.$disconnect());

type Item = { id: string; off: boolean; clashWith: { id: string; classId: string }[]; change: { kind: string } | null };
const ids = (l: { id: string }[]) => l.map((i) => i.id).sort();

test("student Today: today's cancelled slot and the in-class clash; other classes' clashes stay hidden", async () => {
  const body = (await (await agent('student')).get('/api/v1/me/today').expect(200)).body;
  assert.equal(body.date, today().toISOString().slice(0, 10));
  assert.deepEqual(ids(body.items), ['sa', 'sc', 'x2']);
  assert.deepEqual(ids(body.cancelled), ['sc']);
  const sa = body.items.find((i: Item) => i.id === 'sa') as Item;
  assert.deepEqual(sa.clashWith.map((c) => c.id), ['x2']); // not sb (c2)
  assert.deepEqual(body.empty, { timetable: false, subjects: false });
  assert.ok(body.attendance.length >= 5 && body.attendance[0].pct !== undefined);
});

test('student Today: unread posts shrink once seen', async () => {
  const p = await db.post.create({ data: { id: 'p1', authorId: 't2', kind: 'announcement', title: 'Hello', body: 'x', targets: { create: { classId: 'c1' } } } });
  const s1 = await agent('student');
  assert.deepEqual(ids((await s1.get('/api/v1/me/today').expect(200)).body.unreadPosts), [p.id]);
  assert.equal((await s1.get('/api/v1/me/today').expect(200)).body.unreadPosts[0].body, 'x');
  await s1.post(`/api/v1/posts/${p.id}/seen`).expect(204);
  assert.deepEqual((await s1.get('/api/v1/me/today').expect(200)).body.unreadPosts, []);
});

test('teacher Today unions classes and flags the cross-class clash; attendanceDone and canEdit', async () => {
  const body = (await (await agent('subjectTeacher')).get('/api/v1/me/today').expect(200)).body;
  assert.deepEqual(ids(body.sessions), ['sa', 'sb']);
  const [sa, sb] = ['sa', 'sb'].map((id) => body.sessions.find((s: { id: string }) => s.id === id));
  assert.ok(sb.clashWith.some((c: { id: string; classId: string }) => c.id === 'sa' && c.classId === 'c1'));
  assert.ok(sa.clashWith.some((c: { id: string; classId: string }) => c.id === 'sb' && c.classId === 'c2'));
  assert.deepEqual([sa.class.id, sb.class.id, sa.attendanceDone, sb.attendanceDone, sa.canEdit], ['c1', 'c2', true, false, true]);
  // Meera (t1) sees only her own slot; the cancelled one is off
  const t1 = (await (await agent('teacher')).get('/api/v1/me/today').expect(200)).body;
  assert.deepEqual(t1.sessions.map((s: { id: string; off: boolean }) => [s.id, s.off]), [['sc', true]]);
});

test('CS-13: cancellation author.isCr; clashWith[].teacher names the other teacher', async () => {
  const body = (await (await agent('student')).get('/api/v1/me/today').expect(200)).body;
  assert.equal(body.cancelled[0].change.author.isCr, true); // x1 was made by s1, c1's CR
  await db.scheduleChange.update({ where: { id: 'x1' }, data: { authorId: 't1' } });
  const again = (await (await agent('student')).get('/api/v1/me/today').expect(200)).body;
  assert.equal(again.cancelled[0].change.author.isCr, false);
  const sa = again.items.find((i: { id: string }) => i.id === 'sa');
  const sub3 = await db.subject.findUniqueOrThrow({ where: { id: 'sub3' }, include: { teacher: true } });
  assert.deepEqual(sa.clashWith[0].teacher, { id: sub3.teacher!.id, name: sub3.teacher!.name });
});

const day = (n: number) => addDays(today(), n);
const dueAt = (n: number) => new Date(day(n).getTime() + 10 * 3_600_000); // 10:00 UTC on that date: the same institution date in any zone near UTC+5:30

test('upcoming: windows filter, staff see only theirs, reminders are private', async () => {
  const b = (id: string, kind: 'exam' | 'deadline', n: number, subjectId: string | null) => ({ id, classId: 'c1', termId: 'term-c1', kind, subjectId, title: id, date: day(n), authorId: 't1' });
  await db.boardItem.createMany({ data: [b('e3', 'exam', 3, 'sub2'), b('d10', 'deadline', 10, 'sub1'), b('e20', 'exam', 20, 'sub2'), b('past', 'exam', -1, 'sub2'), b('e0', 'exam', 0, null)] });
  await db.post.create({ data: { id: 'a5', authorId: 't2', kind: 'assignment', title: 'a5', body: 'x', dueAt: dueAt(5), targets: { create: { classId: 'c1' } } } });
  const t2 = await agent('subjectTeacher');
  const mine = (await t2.post('/api/v1/me/reminders').send({ title: 'Set paper', date: day(2).toISOString().slice(0, 10) }).expect(201)).body;
  const get = async (a: typeof t2, q = '') => ((await a.get(`/api/v1/me/upcoming${q}`).expect(200)).body.items as { ref: string; kind: string }[]).map((i) => i.ref);

  const student = await agent('student');
  const full = (await t2.get('/api/v1/me/upcoming').expect(200)).body.items as { ref: string; className: string | null; private: boolean }[];
  const rem = full.find((i) => i.ref === mine.id)!;
  assert.deepEqual([rem.className, rem.private], [null, true]);
  assert.ok(full.some((i) => !i.private && i.className));
  assert.deepEqual(await get(student), ['e0', 'e3', 'a5', 'd10']); // 14 days, soonest first, no reminder
  assert.deepEqual(await get(student, '?days=30'), ['e0', 'e3', 'a5', 'd10', 'e20']);
  await student.get('/api/v1/me/upcoming?days=7').expect(422);
  assert.deepEqual(await get(t2), ['e0', mine.id, 'e3', 'a5']); // not Meera's deadline (sub1)
  assert.deepEqual(await get(await agent('teacher')), ['e0', 'e3', 'd10']); // class teacher sees all of c1; the assignment is Arjun's

  // the 7-day Today list for staff includes the reminder; reminders are invisible to everyone else
  assert.ok((await t2.get('/api/v1/me/today').expect(200)).body.upcoming.some((i: { ref: string }) => i.ref === mine.id));
  const t1 = await agent('teacher');
  assert.deepEqual((await t1.get('/api/v1/me/reminders').expect(200)).body.items, []);
  await t1.delete(`/api/v1/me/reminders/${mine.id}`).expect(404);
  await student.get('/api/v1/me/reminders').expect(403);
  await student.post('/api/v1/me/reminders').send({ title: 'x', date: '2030-01-01' }).expect(403);
  assert.equal((await t2.get('/api/v1/me/reminders').expect(200)).body.items.length, 1);
  await t2.delete(`/api/v1/me/reminders/${mine.id}`).expect(204);
  assert.equal(await db.reminder.count(), 0);
});

test('empty placeholders: a class with no timetable', async () => {
  await db.timetableSlot.deleteMany({ where: { classId: 'c1' } });
  const body = (await (await agent('student')).get('/api/v1/me/today').expect(200)).body;
  assert.deepEqual(body.empty, { timetable: true, subjects: false });
});

test('CS-15: codeOpen is null, set once a teacher opens a code, null again after the student checks in', async () => {
  const stu = await agent('student');
  const open = async () => (await stu.get('/api/v1/me/today').expect(200)).body.codeOpen;
  assert.equal(await open(), null);
  const meera = await agent('teacher');
  const s = (await meera.post('/api/v1/attendance-sessions').send({ subjectId: 'sub1', date: today().toISOString().slice(0, 10) }).expect(200)).body;
  assert.equal(await open(), null); // a roll session with no code
  await meera.post(`/api/v1/attendance-sessions/${s.id}/code`).expect(200);
  assert.deepEqual(await open(), { sessionId: s.id, subject: { id: 'sub1', name: (await db.subject.findUniqueOrThrow({ where: { id: 'sub1' } })).name } });
  const { codeSecret } = await db.attendanceSession.findUniqueOrThrow({ where: { id: s.id } });
  await stu.post('/api/v1/checkin').send({ code: codeAt(codeSecret!, 0) }).expect(200);
  assert.equal(await open(), null);
});
