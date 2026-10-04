import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

before(resetDb);
after(() => db.$disconnect());

const url = '/api/v1/commons';
const as = async (id: string) => agent((await db.user.findUniqueOrThrow({ where: { id } })).email);
const authorOf = async (postId: string) => (await db.boardPost.findUniqueOrThrow({ where: { id: postId } })).authorId;
const notes = (userId: string, type: string) => db.notification.count({ where: { userId, type } });
const helped = async (userId: string) => (await (await agent('student')).get(`${url}/profiles/${userId}`).expect(200)).body.track;

test('answers: open asks only, the poster is notified', async () => {
  const riya = await agent('student');
  const asker = await authorOf('bp1');
  const n = await notes(asker, 'board-answer');
  const res = (await riya.post(`${url}/board-posts/bp1/answers`).send({ body: 'Try the ME department store.' }).expect(201)).body;
  assert.equal(res.answers.at(-1).author.id, 's1');
  assert.equal(res.count, 2);
  assert.equal(await notes(asker, 'board-answer'), n + 1);
  await riya.post(`${url}/board-posts/bp2/answers`).send({ body: 'late' }).expect(422); // solved
  await riya.post(`${url}/board-posts/bp4/answers`).send({ body: 'not an ask' }).expect(422);
  await riya.post(`${url}/board-posts/bp1/answers`).send({ body: '' }).expect(422);
  await (await agent('admin')).post(`${url}/board-posts/bp1/answers`).send({ body: 'hi' }).expect(403);
  // The poster can't thank before the ask is closed.
  await (await as(asker)).post(`${url}/thanks`).send({ postId: 'bp1', toId: 's1' }).expect(422);
});

test('gig: interest once, only the author assigns (an interested person), done thanks the assignee; duplicate thanks → 409', async () => {
  const poster = await as(await authorOf('bp4'));
  const s33 = await as('s33'); // already interested (seed)
  const riya = await agent('student');

  await s33.post(`${url}/board-posts/bp4/interests`).send({ note: 'again' }).expect(409);
  await poster.post(`${url}/board-posts/bp4/interests`).send({ note: 'me' }).expect(403);
  const mine = (await riya.post(`${url}/board-posts/bp4/interests`).send({ note: 'I do logos' }).expect(201)).body;
  assert.deepEqual(mine.interests.map((i: { user: { id: string } }) => i.user.id), ['s1'], 'others see only their own note');
  assert.ok(!mine.actions.includes('interest'));
  assert.equal((await poster.get(`${url}/board-posts/bp4`).expect(200)).body.interests.length, 3);

  await riya.post(`${url}/board-posts/bp4/assign`).send({ userId: 's1' }).expect(403);
  await (await agent('admin')).post(`${url}/board-posts/bp4/assign`).send({ userId: 's1' }).expect(403);
  await poster.post(`${url}/board-posts/bp4/assign`).send({ userId: 's3' }).expect(422); // not interested
  const before = await helped('s33');
  const assigned = (await poster.post(`${url}/board-posts/bp4/assign`).send({ userId: 's33' }).expect(200)).body;
  assert.equal(assigned.status, 'assigned');
  assert.equal(assigned.assignee.id, 's33');
  assert.ok(assigned.actions.includes('done'));
  assert.equal(await notes('s33', 'board-assigned'), 1);
  await riya.post(`${url}/board-posts/bp4/interests`).send({ note: 'late' }).expect(422); // no longer open

  await riya.post(`${url}/board-posts/bp4/done`).expect(403);
  const done = (await poster.post(`${url}/board-posts/bp4/done`).expect(200)).body;
  assert.equal(done.status, 'done');
  assert.deepEqual(done.thanked, ['s33']);
  assert.ok(!done.actions.includes('thank'));
  await poster.post(`${url}/board-posts/bp4/done`).expect(422);
  await poster.post(`${url}/thanks`).send({ postId: 'bp4', toId: 's33' }).expect(409);
  const after = await helped('s33');
  assert.equal(after.helped, before.helped + 1, 'thanks count in the track record');
  assert.equal(after.gigsDone, before.gigsDone + 1);
});

test('found: claim once, only the finder confirms; others declined; thanks the confirmed claimer once', async () => {
  const finder = await as(await authorOf('bp12'));
  const riya = await agent('student');
  const s3 = await as('s3');
  await finder.post(`${url}/board-posts/bp12/claims`).send({ answer: 'mine' }).expect(403);
  await riya.post(`${url}/board-posts/bp12/claims`).send({ answer: 'a sticker' }).expect(201);
  await riya.post(`${url}/board-posts/bp12/claims`).send({ answer: 'again' }).expect(409);
  const claim = (await s3.post(`${url}/board-posts/bp12/claims`).send({ answer: 'name sticker on the back' }).expect(201)).body.claims[0];
  assert.equal(await notes(finder.user.id, 'board-claim'), 2);

  await riya.post(`${url}/board-posts/bp12/claims/${claim.id}/confirm`).expect(403);
  await (await agent('admin')).post(`${url}/board-posts/bp12/claims/${claim.id}/confirm`).expect(403);
  await finder.post(`${url}/board-posts/bp12/claims/nope/confirm`).expect(404);
  const back = (await finder.post(`${url}/board-posts/bp12/claims/${claim.id}/confirm`).expect(200)).body;
  assert.equal(back.status, 'returned');
  assert.deepEqual(back.claims.map((c: { user: { id: string }; state: string }) => [c.user.id, c.state]), [['s1', 'declined'], ['s3', 'confirmed']]);
  assert.equal(await notes('s3', 'board-claim'), 1);
  assert.ok(back.actions.includes('thank'));

  await riya.post(`${url}/thanks`).send({ postId: 'bp12', toId: 's3' }).expect(403);
  await finder.post(`${url}/thanks`).send({ postId: 'bp12', toId: 's1' }).expect(422); // declined claimer didn't help
  const before = (await helped('s3')).helped;
  await finder.post(`${url}/thanks`).send({ postId: 'bp12', toId: 's3' }).expect(201);
  await finder.post(`${url}/thanks`).send({ postId: 'bp12', toId: 's3' }).expect(409);
  assert.equal((await helped('s3')).helped, before + 1);
  assert.equal(await notes('s3', 'thanks'), 1);
});
