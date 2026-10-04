import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

before(resetDb);
after(() => db.$disconnect());

const url = '/api/v1/commons';
const as = async (id: string) => agent((await db.user.findUniqueOrThrow({ where: { id } })).email);
const feedIds = async (a: Awaited<ReturnType<typeof agent>>) => (await a.get(`${url}/board-posts?limit=100`).expect(200)).body.items.map((p: { id: string }) => p.id);

test('third distinct report hides the post; duplicates 409; own/missing/bad-reason rejected; audited', async () => {
  const post = await db.boardPost.findFirstOrThrow({ where: { hiddenAt: null, kind: { not: 'gig' }, expiresAt: { gte: new Date() } }, orderBy: { id: 'asc' } });
  const reporters = (await db.user.findMany({ where: { role: 'student', status: 'active', id: { not: post.authorId } }, orderBy: { id: 'asc' }, take: 3 })).map((u) => u.id);
  const body = { targetType: 'board', targetId: post.id, reason: 'Spam' };
  const viewer = await as(reporters[0]!);
  assert.ok((await feedIds(viewer)).includes(post.id));

  await (await as(post.authorId)).post(`${url}/reports`).send(body).expect(422); // own content
  await viewer.post(`${url}/reports`).send({ ...body, targetId: 'nope' }).expect(404);
  await viewer.post(`${url}/reports`).send({ ...body, reason: 'Academic dishonesty' }).expect(422); // gigs only
  await viewer.post(`${url}/reports`).send({ ...body, reason: 'Boredom' }).expect(422);
  await viewer.post(`${url}/reports`).send(body).expect(201);
  await viewer.post(`${url}/reports`).send({ ...body, reason: 'Other' }).expect(409);
  assert.equal((await (await as(reporters[1]!)).post(`${url}/reports`).send(body).expect(201)).body.hidden, false);
  assert.ok((await feedIds(viewer)).includes(post.id), 'two reports do not hide');
  assert.equal((await (await as(reporters[2]!)).post(`${url}/reports`).send(body).expect(201)).body.hidden, true);
  assert.ok(!(await feedIds(viewer)).includes(post.id), 'third report hides it');
  assert.equal(await db.auditLog.count({ where: { action: 'report.auto-hide', targetId: post.id } }), 1);
  await viewer.post(`${url}/reports`).send({ ...body, targetId: post.id }).expect(404); // hidden now
});

test('projects and challenges auto-hide too; gig accepts Academic dishonesty', async () => {
  const gig = await db.boardPost.findFirstOrThrow({ where: { kind: 'gig', hiddenAt: null } });
  const others = (await db.user.findMany({ where: { role: 'student', status: 'active', id: { not: gig.authorId } }, take: 1 }))[0]!;
  await (await as(others.id)).post(`${url}/reports`).send({ targetType: 'board', targetId: gig.id, reason: 'Academic dishonesty' }).expect(201);

  for (const [targetType, model] of [['project', db.project], ['challenge', db.challenge]] as const) {
    const t = await (model as typeof db.project).findFirstOrThrow({ where: { hiddenAt: null } });
    const rs = await db.user.findMany({ where: { role: 'student', status: 'active', id: { not: t.ownerId } }, orderBy: { id: 'desc' }, take: 3 });
    for (const r of rs) await (await as(r.id)).post(`${url}/reports`).send({ targetType, targetId: t.id, reason: 'Harassment' }).expect(201);
    assert.ok((await (model as typeof db.project).findUniqueOrThrow({ where: { id: t.id } })).hiddenAt);
  }
});

test('block hides each side in people, profile, board and conversations; unblock restores; teachers 403', async () => {
  const riya = await agent('student');
  const post = await db.boardPost.findFirstOrThrow({ where: { hiddenAt: null, authorId: { not: 's1' }, expiresAt: { gte: new Date() } } });
  const other = post.authorId;
  const people = async (a: typeof riya) => (await a.get(`${url}/people?limit=100`).expect(200)).body.items.map((p: { id: string }) => p.id);
  const them = await as(other);
  assert.ok((await people(riya)).includes(other));
  assert.ok((await feedIds(riya)).includes(post.id));

  await riya.post(`${url}/blocks`).send({ userId: 's1' }).expect(422);
  await riya.post(`${url}/blocks`).send({ userId: 'nobody' }).expect(404);
  await riya.post(`${url}/blocks`).send({ userId: other }).expect(201);
  await riya.post(`${url}/blocks`).send({ userId: other }).expect(201); // idempotent
  assert.deepEqual((await riya.get(`${url}/blocks`).expect(200)).body.items.map((b: { userId: string }) => b.userId), [other]);

  assert.ok(!(await people(riya)).includes(other));
  assert.ok(!(await people(them)).includes('s1'), 'both directions');
  await riya.get(`${url}/profiles/${other}`).expect(404);
  await them.get(`${url}/profiles/s1`).expect(404);
  assert.ok(!(await feedIds(riya)).includes(post.id));
  await riya.post(`${url}/conversations`).send({ toId: other, note: 'hi' }).expect(403);

  const c = await db.conversation.create({ data: { fromId: other, toId: 's1', note: 'yo', state: 'accepted' } });
  const ids = async (a: typeof riya) => (await a.get(`${url}/conversations`).expect(200)).body.conversations.map((x: { id: string }) => x.id);
  assert.ok(!(await ids(riya)).includes(c.id));
  assert.ok(!(await ids(them)).includes(c.id));

  await riya.delete(`${url}/blocks/${other}`).expect(204);
  assert.ok((await people(riya)).includes(other));
  assert.ok((await ids(riya)).includes(c.id));
  await (await agent('teacher')).get(`${url}/blocks`).expect(403);
});

test('message and profile reports are stored without hiding', async () => {
  const c = await db.conversation.create({ data: { fromId: 's2', toId: 's1', note: 'x', state: 'accepted' } });
  const m = await db.message.create({ data: { conversationId: c.id, senderId: 's2', body: 'rude' } });
  const riya = await agent('student');
  await (await as('s3')).post(`${url}/reports`).send({ targetType: 'message', targetId: m.id, reason: 'Harassment' }).expect(404); // not a participant
  await riya.post(`${url}/reports`).send({ targetType: 'message', targetId: m.id, reason: 'Harassment' }).expect(201);
  await riya.post(`${url}/reports`).send({ targetType: 'profile', targetId: 's1', reason: 'Spam' }).expect(422);
  await riya.post(`${url}/reports`).send({ targetType: 'profile', targetId: 's2', reason: 'Spam' }).expect(201);
  assert.equal(await db.report.count({ where: { reporterId: 's1', targetType: { in: ['message', 'profile'] } } }), 2);
});
