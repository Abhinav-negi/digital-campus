import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

// Seed c1 Monday: tt0 sub1 09:00–10:00 (Meera), tt1 sub2 10:00–11:00 (Arjun), tt2 sub3 11:30–12:30, tt3 sub5 14:00–16:00.
before(resetDb);
after(() => db.$disconnect());

const url = '/api/v1/classes/c1/timetable';
type Week = { termId: string; days: { weekday: number; slots: { id: string; clashWith: string[]; subject: { name: string }; teacher: { name: string } | null }[] }[] };

test('GET: the week grouped Mon..Sat with subject and teacher', async () => {
  const s1 = await agent('student');
  const week: Week = (await s1.get(url).expect(200)).body;
  assert.deepEqual(week.days.map((d) => d.weekday), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(week.days[0]!.slots.map((s) => s.id), ['tt0', 'tt1', 'tt2', 'tt3']);
  assert.equal(week.days[0]!.slots[0]!.teacher?.name, 'Dr. Meera Iyer');
  assert.equal(week.days[5]!.slots.length, 0);
  await (await agent('outsider')).get('/api/v1/classes/c2/timetable').expect(403);
});

test('a student → 403 on every write; the CR adds an overlapping slot, which is accepted and reported', async () => {
  const m = await db.classMember.findFirstOrThrow({ where: { classId: 'c1', role: 'student', user: { status: 'active' } }, include: { user: true } });
  const student = await agent(m.user.email);
  const cr = await agent('cr');
  const slot = { subjectId: 'sub2', weekday: 1, start: '09:30', end: '10:30', room: 'LH-9' };
  await student.post(url).send(slot).expect(403);
  await student.patch(`${url}/tt0`).send({ room: 'X' }).expect(403);
  await student.delete(`${url}/tt0`).expect(403);
  await student.put(url).send({ slots: [] }).expect(403);

  await cr.post(url).send({ ...slot, end: '09:30' }).expect(422); // start < end
  await cr.post(url).send({ ...slot, weekday: 7 }).expect(422);
  await cr.post(url).send({ ...slot, subjectId: 'sub6' }).expect(422); // c2's subject
  const created = (await cr.post(url).send(slot).expect(201)).body;
  assert.deepEqual(created.clashWith.sort(), ['tt0', 'tt1']);
  const monday = ((await cr.get(url).expect(200)).body as Week).days[0]!.slots;
  assert.ok(monday.find((s) => s.id === 'tt0')!.clashWith.includes(created.id));
  assert.deepEqual(monday.find((s) => s.id === 'tt2')!.clashWith, []); // 11:30 doesn't touch 10:30

  const moved = (await cr.patch(`${url}/${created.id}`).send({ start: '12:30', end: '13:30', room: null }).expect(200)).body;
  assert.deepEqual([moved.clashWith, moved.room], [[], null]);
  await cr.patch(`${url}/${created.id}`).send({ start: '14:00' }).expect(422); // 14:00 ≥ 13:30
  await cr.delete(`${url}/${created.id}`).expect(204);
  await cr.delete(`${url}/${created.id}`).expect(404);
  assert.equal(await db.auditLog.count({ where: { classId: 'c1', action: { startsWith: 'timetable.' } } }), 3);
});

test('PUT replaces the week atomically, audited once', async () => {
  const t1 = await agent('teacher'); // class teacher
  const before = await db.timetableSlot.count({ where: { classId: 'c1' } });
  const good = { subjectId: 'sub1', weekday: 2, start: '09:00', end: '10:00' };
  await t1.put(url).send({ slots: [good, { ...good, subjectId: 'sub6' }] }).expect(422); // one bad row → nothing written
  assert.equal(await db.timetableSlot.count({ where: { classId: 'c1' } }), before);

  const week: Week = (await t1.put(url).send({ slots: [good, { ...good, subjectId: 'sub2', start: '09:30', end: '11:00' }] }).expect(200)).body;
  assert.equal(await db.timetableSlot.count({ where: { classId: 'c1' } }), 2);
  assert.equal(week.days[1]!.slots.length, 2);
  assert.equal(week.days[1]!.slots[0]!.clashWith.length, 1);
  const log = await db.auditLog.findMany({ where: { classId: 'c1', action: 'timetable.replace' } });
  assert.equal(log.length, 1);
  assert.deepEqual([(log[0]!.before as { count: number }).count, (log[0]!.after as { count: number }).count], [before, 2]);
});
