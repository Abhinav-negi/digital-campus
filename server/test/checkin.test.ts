import assert from 'node:assert/strict';
import { after, before, mock, test } from 'node:test';
import { today } from '../src/lib/dates.js';
import { db } from '../src/lib/db.js';
import { codeAt, MAX_FAILS } from '../src/modules/attendance/code.js';
import { agent, resetDb } from './helpers.js';

// CS-10 with a fake clock (Date only). Seed: sub2 Discrete Maths (c1) is Arjun's (t2); s2..s7 are active c1 students, s31 is in c2.
before(resetDb);
after(() => {
  mock.timers.reset();
  return db.$disconnect();
});

const URL = '/api/v1/attendance-sessions';
const student = async (id: string) => agent((await db.user.findUniqueOrThrow({ where: { id } })).email);

test('rotating code: current + previous window, 2-minute limit, same device flagged, the save is final', async () => {
  const t0 = Date.now();
  mock.timers.enable({ apis: ['Date'], now: t0 });
  const at = (sec: number) => mock.timers.setTime(t0 + sec * 1000);

  const arjun = await agent('subjectTeacher');
  const s = (await arjun.post(URL).send({ subjectId: 'sub2', date: today().toISOString().slice(0, 10) }).expect(200)).body;
  const { windowEndsAt } = (await arjun.post(`${URL}/${s.id}/code`).expect(200)).body;
  assert.equal(new Date(windowEndsAt).getTime(), t0 + 120_000);
  const absent = await db.attendance.count({ where: { sessionId: s.id, present: false } });
  assert.equal(absent, s.roster.length); // everyone absent-pending

  const { codeSecret } = await db.attendanceSession.findUniqueOrThrow({ where: { id: s.id } });
  const code = (step: number) => codeAt(codeSecret!, step);
  const [s2, s3, s4, s5, s31] = await Promise.all(['s2', 's3', 's4', 's5', 's31'].map(student));
  const checkin = (a: typeof s2, c: string, device: string) => a.post('/api/v1/checkin').set('X-Device-Id', device).send({ code: c });

  const screen = (await arjun.get(`${URL}/${s.id}/code`).expect(200)).body;
  assert.deepEqual([screen.code, screen.secondsLeft], [code(0), 20]);
  await s2.get(`${URL}/${s.id}/code`).expect(403); // students never see the code
  const ok = (await checkin(s2, code(0), 'dev-a').expect(200)).body;
  assert.deepEqual(ok, { sessionId: s.id, subject: { id: 'sub2', name: 'Discrete Mathematics' } });
  await checkin(s31, code(0), 'dev-z').expect(422); // another class's code

  at(25); // step 1: the current and the previous code work
  assert.equal((await arjun.get(`${URL}/${s.id}/code`).expect(200)).body.secondsLeft, 15);
  await checkin(s3, code(0), 'dev-b').expect(200);
  await checkin(s4, code(1), 'dev-c').expect(200);
  at(45); // step 2: step 0 is two windows old
  const bad = await checkin(s5, code(0), 'dev-d').expect(422);
  assert.equal(bad.body.error.message, "That code didn't match");
  await checkin(s5, code(2), 'dev-c').expect(200); // s4's device: both flagged, both present

  const live = (await arjun.get(`${URL}/${s.id}/code`).expect(200)).body;
  assert.deepEqual(new Set(live.checkedIn), new Set(['s2', 's3', 's4', 's5']));
  assert.deepEqual(new Set(live.flagged), new Set(['s4', 's5']));
  const rows = await db.attendance.findMany({ where: { sessionId: s.id, studentId: { in: ['s4', 's5'] } } });
  assert.ok(rows.every((r) => r.present && r.flagged && r.source === 'code' && r.deviceId === 'dev-c'));

  at(120); // the window is over
  await checkin(s5, code(6), 'dev-d').expect(422);
  await checkin(s5, code(5), 'dev-d').expect(422);
  assert.equal((await arjun.get(`${URL}/${s.id}/code`).expect(200)).body.code, null);

  // The teacher's save is final: s2 checked in but is marked absent, and the code can't reopen a saved session.
  at(60);
  const saved = (await arjun.put(`${URL}/${s.id}`).send({ absentIds: ['s2'] }).expect(200)).body;
  assert.deepEqual(saved.flaggedIds.sort(), ['s4', 's5']);
  await checkin(s2, code(3), 'dev-a').expect(422);
  assert.equal((await db.attendance.findFirstOrThrow({ where: { sessionId: s.id, studentId: 's2' } })).present, false);
  await arjun.post(`${URL}/${s.id}/code`).expect(409);
  mock.timers.reset();
});

test('wrong guesses are rate-limited per student; staff cannot check in', async () => {
  const s6 = await student('s6');
  for (let i = 0; i < MAX_FAILS; i++) await s6.post('/api/v1/checkin').send({ code: '0000' }).expect(422);
  await s6.post('/api/v1/checkin').send({ code: '0000' }).expect(429);
  await (await student('s7')).post('/api/v1/checkin').send({ code: '0000' }).expect(422); // others unaffected
  await (await student('s7')).post('/api/v1/checkin').send({ code: '12a4' }).expect(422);
  await (await agent('teacher')).post('/api/v1/checkin').send({ code: '0000' }).expect(403);
});
