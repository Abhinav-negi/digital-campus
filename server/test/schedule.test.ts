import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { addDays, dow, today } from '../src/lib/dates.js';
import { db } from '../src/lib/db.js';
import { type Change, type Slot, clashes, daySchedule, teacherClashes } from '../src/modules/classes/schedule.math.js';
import { agent, resetDb } from './helpers.js';

// --- schedule.math.ts (pure) ---
const MON = new Date('2030-01-07'); // a Monday
const TUE = addDays(MON, 1);
const slot = (id: string, start: string, end: string, o: Partial<Slot> = {}): Slot => ({ id, classId: 'c1', subjectId: 'sA', teacherId: 'tA', weekday: 1, start, end, room: null, ...o });
const change = (id: string, kind: Change['kind'], o: Partial<Change> = {}): Change => ({
  id, classId: 'c1', kind, date: MON, slotId: null, subjectId: null, teacherId: null, title: null, start: null, end: null, room: null, movedToDate: null, ...o,
});
const live = (items: { id: string; off: boolean }[]) => items.filter((i) => !i.off).map((i) => i.id);

test('math: cancel hides; a move hides the original and shows on the target date/time', () => {
  const slots = [slot('a', '09:00', '10:00'), slot('b', '10:00', '11:00', { teacherId: 'tB' })];
  assert.deepEqual(live(daySchedule(slots, [], MON)), ['a', 'b']);
  assert.deepEqual(live(daySchedule(slots, [], TUE)), []);
  const cancelled = daySchedule(slots, [change('x', 'cancelled', { slotId: 'a' })], MON);
  assert.deepEqual([live(cancelled), cancelled[0]!.change?.id], [['b'], 'x']);

  const away = [change('m', 'moved', { slotId: 'a', start: '14:00', end: '15:00', movedToDate: TUE })];
  assert.deepEqual(live(daySchedule(slots, away, MON)), ['b']);
  const tue = daySchedule(slots, away, TUE);
  assert.deepEqual(tue.map((i) => [i.id, i.slotId, i.start, i.end, i.off]), [['m', 'a', '14:00', '15:00', false]]);

  const sameDay = daySchedule(slots, [change('m', 'moved', { slotId: 'a', start: '12:00', end: '13:00' })], MON);
  assert.deepEqual(sameDay.map((i) => [i.id, i.start]), [['b', '10:00'], ['m', '12:00']]);
});

test('math: extra and event add', () => {
  const day = daySchedule(
    [slot('a', '09:00', '10:00')],
    [change('e', 'extra', { subjectId: 'sA', start: '11:00', end: '12:00' }), change('v', 'event', { title: 'Fest', start: '08:00', end: '08:30' }), change('o', 'extra', { date: TUE, start: '11:00', end: '12:00' })],
    MON,
  );
  assert.deepEqual(day.map((i) => [i.id, i.kind]), [['v', 'event'], ['a', 'class'], ['e', 'extra']]);
});

test('math: overlap rules', () => {
  const pair = (a: [string, string], b: [string, string]) => clashes(daySchedule([slot('a', ...a), slot('b', ...b)], [], MON)).every((i) => i.clashWith.length === 1);
  assert.ok(pair(['13:00', '14:00'], ['13:00', '13:30']));
  assert.ok(pair(['10:00', '11:00'], ['10:30', '11:30']));
  assert.ok(!pair(['10:00', '11:00'], ['11:00', '12:00']));
  // a cancelled item never clashes
  const day = daySchedule([slot('a', '10:00', '11:00'), slot('b', '10:30', '11:30')], [change('x', 'cancelled', { slotId: 'a' })], MON);
  assert.deepEqual(day.map((i) => i.clashWith), [[], []]);
});

test('math: one teacher in two classes clashes; cancelling one clears it', () => {
  const c1 = [slot('a', '10:00', '11:00')];
  const c2 = [slot('z', '10:30', '11:30', { classId: 'c2' })];
  const both = (changes: Change[]) => teacherClashes([...daySchedule(c1, changes, MON), ...daySchedule(c2, [], MON)]);
  assert.deepEqual(both([]).map((i) => i.clashWith), [['z'], ['a']]);
  assert.deepEqual(daySchedule(c1, [], MON)[0]!.clashWith, []); // not an in-class clash
  assert.deepEqual(both([change('x', 'cancelled', { slotId: 'a' })]).map((i) => i.clashWith), [[], []]);
});

// --- API ---
before(resetDb);
after(() => db.$disconnect());

const DAY = '2030-01-07'; // Monday, no seeded changes: tt0 sub1 09–10 Meera (t1), tt1 sub2 10–11 Arjun (t2), tt2 sub3 11:30–12:30 David (t4)
const changes = '/api/v1/classes/c1/changes';
const scheduleOn = async (a: Awaited<ReturnType<typeof agent>>, date: string, classId = 'c1') =>
  (await a.get(`/api/v1/classes/${classId}/schedule?from=${date}`).expect(200)).body.days[0].items as {
    id: string; slotId: string | null; off: boolean; start: string; change: { kind: string } | null; clashWith: { id: string; className: string }[];
  }[];

test('the seeded class day: sc1 is cancelled (off) and sc2 clashes with the first slot', async () => {
  const d0 = today();
  const classDay = dow(d0) <= 5 ? d0 : addDays(d0, 8 - dow(d0));
  const items = await scheduleOn(await agent('student'), classDay.toISOString().slice(0, 10));
  const sc1 = await db.scheduleChange.findUniqueOrThrow({ where: { id: 'sc1' } });
  const cancelled = items.find((i) => i.slotId === sc1.slotId)!;
  assert.deepEqual([cancelled.off, cancelled.change?.kind], [true, 'cancelled']);
  const sc2 = items.find((i) => i.id === 'sc2')!;
  assert.equal(sc2.clashWith.length, 1);
  assert.equal(items.find((i) => i.id === sc2.clashWith[0]!.id)!.start, '09:00');
});

test("Arjun can't cancel Meera's slot (403); the CR can; he can cancel his own; undo follows the same rule", async () => {
  const t2 = await agent('subjectTeacher');
  const cr = await agent('cr');
  const m = await db.classMember.findFirstOrThrow({ where: { classId: 'c1', role: 'student', user: { status: 'active' } }, include: { user: true } });
  await t2.post(changes).send({ date: DAY, kind: 'cancelled', slotId: 'tt0' }).expect(403);
  await (await agent(m.user.email)).post(changes).send({ date: DAY, kind: 'cancelled', slotId: 'tt0' }).expect(403);
  await t2.post(changes).send({ date: DAY, kind: 'extra', subjectId: 'sub1', start: '16:00', end: '17:00' }).expect(403); // not his subject
  await cr.post(changes).send({ date: '2030-01-08', kind: 'cancelled', slotId: 'tt0' }).expect(422); // tt0 isn't on Tuesday

  const c = (await cr.post(changes).send({ date: DAY, kind: 'cancelled', slotId: 'tt0', note: 'Away' }).expect(201)).body;
  await t2.post(changes).send({ date: DAY, kind: 'moved', slotId: 'tt1', start: '15:00', end: '16:00', movedToDate: '2030-01-09' }).expect(201);
  const items = await scheduleOn(cr, DAY);
  assert.ok(items.find((i) => i.id === 'tt0')!.off);
  assert.ok(items.find((i) => i.id === 'tt1')!.off);
  assert.ok((await scheduleOn(cr, '2030-01-09')).some((i) => i.slotId === 'tt1' && i.start === '15:00'));
  // everyone in the class hears about it (class-change, can't be muted), audited
  const n = await db.notification.findFirstOrThrow({ where: { userId: m.userId, type: 'class-change', payload: { path: ['changeId'], equals: c.id } } });
  assert.match((n.payload as { text: string }).text, /Data Structures is cancelled/);
  assert.equal(await db.auditLog.count({ where: { classId: 'c1', action: 'schedule.cancel', targetId: c.id } }), 1);

  await t2.delete(`${changes}/${c.id}`).expect(403);
  await cr.delete(`${changes}/${c.id}`).expect(204);
  await cr.delete(`${changes}/${c.id}`).expect(404);
  assert.ok(!(await scheduleOn(cr, DAY)).find((i) => i.id === 'tt0')!.off);
});

test('a clash notifies both teachers, across classes too; cancelling one clears it', async () => {
  const cr = await agent('cr');
  const date = '2030-01-14'; // a clean Monday
  await db.notification.deleteMany({ where: { type: 'clash' } });
  // Meera's extra at 11:30 overlaps David's tt2 here, and her own Data Structures in c2 (Mon 11:30–12:30)
  const extra = (await cr.post(changes).send({ date, kind: 'extra', subjectId: 'sub1', start: '11:30', end: '12:30', room: 'LH-3' }).expect(201)).body;
  const got = await db.notification.findMany({ where: { type: 'clash' }, orderBy: { userId: 'asc' } });
  assert.deepEqual([...new Set(got.map((n) => n.userId))], ['t1', 't4']);
  const p = got.find((n) => n.userId === 't4')!.payload as { text: string; items: { id: string; cancel: object }[] };
  assert.match(p.text, /Two classes overlap at 11:30/);
  assert.deepEqual(p.items.map((i) => i.id).sort(), [extra.id, 'tt2'].sort());
  assert.ok(p.items.every((i) => i.cancel));

  const meera = await agent('teacher');
  const item = (await scheduleOn(meera, date)).find((i) => i.id === extra.id)!;
  assert.deepEqual(item.clashWith.map((c) => c.className).sort(), ['CSE · 2nd year · A', 'CSE · 2nd year · B']);
  // Students only see clashes inside their own class, never another class's schedule.
  assert.deepEqual((await scheduleOn(cr, date)).find((i) => i.id === extra.id)!.clashWith.map((c) => c.className), ['CSE · 2nd year · A']);
  const c2 = await scheduleOn(meera, date, 'c2');
  assert.ok(c2.some((i) => i.clashWith.some((c) => c.id === extra.id)));

  await cr.post(changes).send({ date, kind: 'cancelled', slotId: 'tt2' }).expect(201);
  assert.deepEqual((await scheduleOn(meera, date)).find((i) => i.id === extra.id)!.clashWith.map((c) => c.className), ['CSE · 2nd year · B']);
  await cr.delete(`${changes}/${extra.id}`).expect(204);
  assert.equal(await db.notification.count({ where: { type: 'clash' } }), got.length); // undoing removes clashes, never adds
});

test('validation: range ≤ 14 days, extras need a subject, events a title', async () => {
  const cr = await agent('cr');
  await cr.get('/api/v1/classes/c1/schedule?from=2030-01-07&to=2030-01-20').expect(200);
  await cr.get('/api/v1/classes/c1/schedule?from=2030-01-07&to=2030-01-21').expect(422);
  await cr.get('/api/v1/classes/c1/schedule?from=2030-01-07&to=2030-01-06').expect(422);
  await cr.post(changes).send({ date: DAY, kind: 'extra', start: '16:00', end: '17:00' }).expect(422);
  await cr.post(changes).send({ date: DAY, kind: 'event', start: '16:00', end: '17:00' }).expect(422);
  await cr.post(changes).send({ date: DAY, kind: 'event', title: 'Fest', start: '17:00', end: '16:00' }).expect(422);
  await cr.post(changes).send({ date: DAY, kind: 'event', title: 'Tech fest', start: '16:00', end: '17:00' }).expect(201);
});
