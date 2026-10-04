import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { attendanceDigest, boardExpiryNudges, cleanInvites, examReminders, start } from '../src/jobs.js';
import { addDays, today } from '../src/lib/dates.js';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

before(resetDb);
after(() => db.$disconnect());

const now = new Date();
const day = today();
const count = (type: string, userId?: string) => db.notification.count({ where: { type, ...(userId && { userId }) } });

test('start() schedules nothing under test', () => {
  start(); // would keep the process alive if it scheduled cron tasks
});

test('exam 3 days and deadline 1 day away notify the class and the subject teacher, once per day', async () => {
  await db.notification.deleteMany();
  await db.boardItem.deleteMany();
  const base = { classId: 'c1', termId: 'term-c1', subjectId: 'sub2', authorId: 't2' };
  const sub = await db.subject.findUniqueOrThrow({ where: { id: 'sub2' } });
  assert.equal(sub.classId, 'c1');
  await db.boardItem.createMany({
    data: [
      { ...base, id: 'e3', kind: 'exam', title: 'Midterm', date: addDays(day, 3) },
      { ...base, id: 'd1', kind: 'deadline', title: 'Lab report', date: addDays(day, 1) },
      { ...base, id: 'e2', kind: 'exam', title: 'Not yet', date: addDays(day, 2) },
    ],
  });
  const students = await db.classMember.count({ where: { classId: 'c1', role: { in: ['student', 'cr'] } } });
  const sent = await examReminders(now);
  assert.equal(sent, 2 * (students + (sub.teacherId ? 1 : 0)));
  assert.equal(await examReminders(now), 0); // idempotent
  assert.equal(await count('exam-reminder', 's1'), 1);
  assert.equal(await count('exam-reminder', sub.teacherId!), 1);
  const n = await db.notification.findFirstOrThrow({ where: { type: 'deadline-reminder', userId: 's1' } });
  assert.match((n.payload as { text: string }).text, /Lab report.*tomorrow/);
});

test('a student who muted exam reminders gets none; class-change cannot be muted', async () => {
  await db.notification.deleteMany();
  const s = await agent('student');
  await s.put('/api/v1/me/notification-prefs').send({ muted: ['class-change'] }).expect(422);
  await s.put('/api/v1/me/notification-prefs').send({ muted: ['exam-reminder', 'exam-reminder'] }).expect(200, { muted: ['exam-reminder'] });
  assert.deepEqual((await s.get('/api/v1/me/notification-prefs').expect(200)).body, { muted: ['exam-reminder'] });
  await examReminders(now);
  assert.equal(await count('exam-reminder', 's1'), 0);
  assert.equal(await count('deadline-reminder', 's1'), 1);
});

test('board posts expiring in 2 days nudge the poster once; an extended post nudges again later', async () => {
  const mk = (id: string, ex: number, extra = {}) => ({ id, authorId: 's1', kind: 'ask' as const, title: id, expiresAt: addDays(day, ex), ...extra });
  await db.boardPost.deleteMany();
  await db.boardPost.createMany({ data: [mk('bp1', 2), mk('bp2', 3), mk('bp3', 2, { status: 'solved' })] });
  assert.equal(await boardExpiryNudges(now), 1);
  assert.equal(await boardExpiryNudges(now), 0);
  const n = await db.notification.findFirstOrThrow({ where: { type: 'board-expiring' } });
  assert.equal(n.userId, 's1');
  assert.equal((n.payload as { postId: string }).postId, 'bp1');
  await db.boardPost.update({ where: { id: 'bp1' }, data: { expiresAt: addDays(day, 16) } });
  assert.equal(await boardExpiryNudges(addDays(now, 14)), 1);
});

test('invite cleanup removes only expired, unaccepted invites created over 30 days ago', async () => {
  const mk = (id: string, createdAt: Date, expiresAt: Date, acceptedAt: Date | null) => ({ id, email: `${id}@x.edu`, role: 'student' as const, classId: 'c1', invitedById: 't1', tokenHash: id, createdAt, expiresAt, acceptedAt });
  const old = addDays(now, -40);
  await db.invite.createMany({
    data: [mk('i-old', old, addDays(now, -33), null), mk('i-acc', old, addDays(now, -33), old), mk('i-live', old, addDays(now, 5), null), mk('i-new', addDays(now, -2), addDays(now, -1), null)],
  });
  assert.equal(await cleanInvites(now), 1);
  assert.deepEqual((await db.invite.findMany({ where: { id: { startsWith: 'i-' } }, select: { id: true } })).map((i) => i.id).sort(), ['i-acc', 'i-live', 'i-new']);
});

test('attendance digest lists low subjects once, only on change, and not twice in a week', async () => {
  await db.notification.deleteMany();
  await db.attendance.deleteMany();
  await db.attendanceSession.deleteMany();
  const mkSession = (id: string, subjectId: string, i: number) => ({ id, termId: 'term-c1', subjectId, date: addDays(day, -i - 1), savedAt: now });
  await db.attendanceSession.createMany({ data: [mkSession('as1', 'sub2', 0), mkSession('as2', 'sub2', 1)] });
  await db.attendance.createMany({ data: [{ sessionId: 'as1', studentId: 's1', present: false, source: 'teacher' }, { sessionId: 'as2', studentId: 's1', present: true, source: 'teacher' }] });
  assert.equal(await attendanceDigest(now), 1); // 50% < 75
  assert.equal(await attendanceDigest(now), 0);
  assert.equal(await attendanceDigest(addDays(now, 8)), 0); // a week on, but nothing changed
  await db.attendance.update({ where: { sessionId_studentId: { sessionId: 'as2', studentId: 's1' } }, data: { present: false } });
  await db.attendanceSession.update({ where: { id: 'as2' }, data: { subjectId: 'sub1' } });
  assert.equal(await attendanceDigest(addDays(now, 8)), 1); // changed set, outside the week
  const n = await db.notification.findFirstOrThrow({ where: { type: 'attendance-digest' }, orderBy: { createdAt: 'desc' } });
  assert.match((n.payload as { text: string }).text, /below the minimum/);
});

test('inbox: rendered text and link, unread count, mark read by ids and all, cursor paging', async () => {
  await db.notification.deleteMany({ where: { userId: 's1' } });
  await db.notification.createMany({
    data: [
      { userId: 's1', type: 'class-change', payload: { text: 'Maths cancelled', classId: 'c1' }, createdAt: addDays(now, -1) },
      { userId: 's1', type: 'post', payload: { text: 'New post', postId: 'p9' }, createdAt: addDays(now, -2) },
      { userId: 's1', type: 'thanks', payload: { text: 'Thanks!' } , createdAt: addDays(now, -3) },
    ],
  });
  const s = await agent('student');
  const first = (await s.get('/api/v1/me/notifications?limit=2').expect(200)).body;
  assert.deepEqual(first.items.map((i: { text: string; link: string }) => [i.text, i.link]), [['Maths cancelled', '/s/today'], ['New post', '/s/posts/p9']]);
  assert.equal(first.unreadCount, 3);
  assert.ok(first.nextCursor);
  const rest = (await s.get(`/api/v1/me/notifications?limit=2&cursor=${first.nextCursor}`).expect(200)).body;
  assert.deepEqual(rest.items.map((i: { text: string }) => i.text), ['Thanks!']);
  assert.equal(rest.nextCursor, null);
  assert.equal((await s.post('/api/v1/me/notifications/read').send({ ids: [first.items[0].id] }).expect(200)).body.unreadCount, 2);
  assert.equal((await s.post('/api/v1/me/notifications/read').send({ all: true }).expect(200)).body.unreadCount, 0);
  const again = (await s.get('/api/v1/me/notifications').expect(200)).body;
  assert.ok(again.items.every((i: { read: boolean }) => i.read));
});
