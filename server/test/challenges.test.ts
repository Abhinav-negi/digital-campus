import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { addDays, today } from '../src/lib/dates.js';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

before(resetDb);
after(() => db.$disconnect());

const url = '/api/v1/commons';
const as = async (id: string) => agent((await db.user.findUniqueOrThrow({ where: { id } })).email);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
type Card = { id: string; live: boolean; winners: { id: string }[] };

test('list: live first, counts and the owner-picked winner', async () => {
  const { body } = await (await agent('student')).get(`${url}/challenges`).expect(200);
  const ids = body.items.map((c: Card) => c.id);
  assert.deepEqual(ids, ['ch1', 'ch2', 'ch3']);
  const ch3 = body.items.find((c: Card) => c.id === 'ch3');
  assert.equal(ch3.live, false);
  assert.deepEqual(ch3.winners.map((w: { id: string }) => w.id), ['s33']);
  assert.equal(body.items[0].submissionCount, 2);
  assert.deepEqual(body.items[0].winners, []); // ch1 is still live
  assert.ok(!JSON.stringify(body).includes('@'));
});

test('likes: toggle while live, not my own, frozen after the end; the likes winner is computed', async () => {
  const riya = await agent('student');
  let c = (await riya.post(`${url}/submissions/sb1/like`).expect(200)).body; // Riya had liked sb1: unlike
  let sb1 = c.submissions.find((s: { id: string }) => s.id === 'sb1');
  assert.equal(sb1.likes, 2);
  assert.equal(sb1.likedByMe, false);
  c = (await riya.post(`${url}/submissions/sb1/like`).expect(200)).body;
  sb1 = c.submissions[0];
  assert.equal(sb1.id, 'sb1'); // most liked first
  assert.equal(sb1.likes, 3);
  assert.equal(sb1.likedByMe, true);
  await (await as('s7')).post(`${url}/submissions/sb1/like`).expect(403); // own
  await riya.post(`${url}/submissions/sb5/like`).expect(422); // ch3 ended
  await (await agent('admin')).post(`${url}/submissions/sb2/like`).expect(403);

  await db.challenge.update({ where: { id: 'ch1' }, data: { endsAt: addDays(today(), -1) } });
  await riya.post(`${url}/submissions/sb2/like`).expect(422); // frozen
  const d = (await riya.get(`${url}/challenges/ch1`).expect(200)).body;
  assert.equal(d.live, false);
  assert.deepEqual(d.winners.map((w: { id: string }) => w.id), ['s7']);
  assert.equal(d.canSubmit, false);
});

test('submissions: http(s) only, once each, live only', async () => {
  const riya = await agent('student');
  const c = (await riya.post(`${url}/challenges`).send({ title: 'Logo sprint', description: 'Design a logo', endsAt: ymd(today()), judging: 'owner' }).expect(201)).body;
  assert.equal(c.live, true);
  assert.equal(c.canSubmit, true);
  await riya.post(`${url}/challenges`).send({ title: 'x', description: 'y', endsAt: ymd(addDays(today(), -1)), judging: 'likes' }).expect(422);
  await riya.post(`${url}/challenges/${c.id}/submissions`).send({ url: 'javascript:alert(1)' }).expect(422);
  const s = (await riya.post(`${url}/challenges/${c.id}/submissions`).send({ url: 'https://figma.com/f/logo', note: 'v1' }).expect(201)).body;
  assert.equal(s.submissionCount, 1);
  assert.equal(s.canSubmit, false);
  await riya.post(`${url}/challenges/${c.id}/submissions`).send({ url: 'https://figma.com/f/logo2' }).expect(409); // second
  await riya.post(`${url}/challenges/ch2/submissions`).send({ url: 'https://leetcode.com/u/riya' }).expect(409); // seeded sb4
  await riya.post(`${url}/challenges/ch3/submissions`).send({ url: 'https://example.com' }).expect(422); // ended
  await (await agent('teacher')).get(`${url}/challenges`).expect(403);
});

test('winners: the owner of an ended, owner-judged challenge picks submitters', async () => {
  const s20 = await as('s20');
  await (await agent('student')).put(`${url}/challenges/ch3/winners`).send({ userIds: ['s33'] }).expect(403);
  await s20.put(`${url}/challenges/ch3/winners`).send({ userIds: ['s1'] }).expect(422); // didn't submit
  await (await as('s44')).put(`${url}/challenges/ch2/winners`).send({ userIds: ['s1'] }).expect(422); // still live
  await db.challenge.update({ where: { id: 'ch3' }, data: { winnerIds: [] } });
  const n = await db.notification.count({ where: { userId: 's33', type: 'challenge-winner' } });
  const d = (await s20.put(`${url}/challenges/ch3/winners`).send({ userIds: ['s33'] }).expect(200)).body;
  assert.deepEqual(d.winners.map((w: { id: string }) => w.id), ['s33']);
  assert.equal(await db.notification.count({ where: { userId: 's33', type: 'challenge-winner' } }), n + 1);
});
