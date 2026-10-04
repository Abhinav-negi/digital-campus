import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

before(resetDb);
after(() => db.$disconnect());

const url = '/api/v1/commons';
const as = async (id: string) => agent((await db.user.findUniqueOrThrow({ where: { id } })).email);
const notes = (userId: string, type: string) => db.notification.count({ where: { userId, type } });
/** Students (not me) in Focus / not in Focus, with no conversation with `me`. */
const strangers = async (me: string, focus: boolean) => {
  const known = await db.conversation.findMany({ where: { OR: [{ fromId: me }, { toId: me }] }, select: { fromId: true, toId: true } });
  const skip = new Set([me, ...known.flatMap((c) => [c.fromId, c.toId])]);
  const all = await db.user.findMany({ where: { role: 'student', status: 'active' }, include: { profile: true }, orderBy: { id: 'asc' } });
  return all.filter((u) => !skip.has(u.id) && (u.profile?.availability === 'focus') === focus).map((u) => u.id);
};

test('Focus blocks a cold request but not a post-linked message', async () => {
  const riya = await agent('student');
  const [focus] = await strangers('s1', true);
  const [open] = await strangers('s1', false);
  const r = await riya.post(`${url}/conversations`).send({ toId: focus, note: 'hi' }).expect(403);
  assert.equal(r.body.error.code, 'IN_FOCUS');
  await riya.post(`${url}/conversations`).send({ toId: 's1', note: 'me' }).expect(422);
  await riya.post(`${url}/conversations`).send({ toId: open, note: '' }).expect(422);
  await (await agent('teacher')).post(`${url}/conversations`).send({ toId: open, note: 'hi' }).expect(403);

  // Post-linked: the author of bp7 (market) in Focus still gets an accepted conversation, with the default first line.
  const bp = await db.boardPost.findUniqueOrThrow({ where: { id: 'bp7' } });
  await db.profile.upsert({ where: { userId: bp.authorId }, update: { availability: 'focus', focusUntil: new Date(Date.now() + 5 * 864e5) }, create: { userId: bp.authorId, availability: 'focus', focusUntil: new Date(Date.now() + 5 * 864e5) } });
  const n = await notes(bp.authorId, 'message');
  const c = (await riya.post(`${url}/board-posts/bp7/message`).expect(201)).body;
  assert.equal(c.state, 'accepted');
  assert.equal(c.note, `Hi, is "${bp.title}" still available?`);
  assert.equal(await notes(bp.authorId, 'message'), n + 1);
  assert.equal((await riya.post(`${url}/board-posts/bp7/message`).expect(200)).body.id, c.id, 'reused');
  await riya.post(`${url}/board-posts/bp1/message`).expect(422); // asks are answered publicly
  await (await as(bp.authorId)).post(`${url}/board-posts/bp7/message`).expect(403); // own post
});

test('request → respond → messages; the sender never learns of an ignore; incoming/outgoing lists', async () => {
  const [a, b, c] = await strangers('s1', false);
  const riya = await agent('student');
  const n = await notes(a, 'message-request');
  const req = (await riya.post(`${url}/conversations`).send({ toId: a, note: 'React help?' }).expect(201)).body;
  assert.equal(req.state, 'requested');
  assert.equal(await notes(a, 'message-request'), n + 1);
  await riya.post(`${url}/conversations`).send({ toId: a, note: 'again' }).expect(409);
  await riya.post(`${url}/conversations/${req.id}/messages`).send({ body: 'x' }).expect(403); // not accepted yet

  const them = await as(a);
  assert.deepEqual((await them.get(`${url}/conversations`).expect(200)).body.incoming.map((x: { id: string }) => x.id), [req.id]);
  await riya.post(`${url}/conversations/${req.id}/respond`).send({ state: 'accepted' }).expect(403); // sender can't respond
  await (await as(b)).post(`${url}/conversations/${req.id}/respond`).send({ state: 'accepted' }).expect(403);
  await them.post(`${url}/conversations/${req.id}/respond`).send({ state: 'accepted' }).expect(200);
  await them.post(`${url}/conversations/${req.id}/respond`).send({ state: 'ignored' }).expect(409);
  assert.equal(await notes('s1', 'message-accepted'), 1);

  await riya.post(`${url}/conversations/${req.id}/messages`).send({ body: 'Thanks!' }).expect(201);
  await them.post(`${url}/conversations/${req.id}/messages`).send({ body: 'Sure' }).expect(201);
  await (await as(b)).post(`${url}/conversations/${req.id}/messages`).send({ body: 'sneaky' }).expect(403); // non-participant
  await (await as(b)).get(`${url}/conversations/${req.id}/messages`).expect(403);
  const msgs = (await riya.get(`${url}/conversations/${req.id}/messages?limit=1`).expect(200)).body;
  assert.equal(msgs.items[0].body, 'Thanks!');
  const rest = (await riya.get(`${url}/conversations/${req.id}/messages?cursor=${msgs.nextCursor}`).expect(200)).body;
  assert.deepEqual(rest.items.map((m: { body: string }) => m.body), ['Sure']);
  const list = (await riya.get(`${url}/conversations`).expect(200)).body;
  assert.equal(list.conversations.find((x: { id: string }) => x.id === req.id).lastMessage, 'Sure');
  // The admin reads any thread (D2) but cannot write.
  const admin = await agent('admin');
  assert.equal((await admin.get(`${url}/conversations/${req.id}/messages`).expect(200)).body.items.length, 2);
  await admin.post(`${url}/conversations/${req.id}/messages`).send({ body: 'hi' }).expect(403);
  await admin.post(`${url}/conversations/${req.id}/respond`).send({ state: 'ignored' }).expect(403);

  // Ignored: the sender still sees "requested"; after 7 days it drops from the sender's list.
  const ign = (await riya.post(`${url}/conversations`).send({ toId: c, note: 'hello' }).expect(201)).body;
  await (await as(c)).post(`${url}/conversations/${ign.id}/respond`).send({ state: 'ignored' }).expect(200);
  const out = (await riya.get(`${url}/conversations`).expect(200)).body.outgoing.find((x: { id: string }) => x.id === ign.id);
  assert.equal(out.state, 'requested');
  assert.equal((await (await as(c)).get(`${url}/conversations`).expect(200)).body.incoming.length, 0);
  await db.conversation.update({ where: { id: ign.id }, data: { createdAt: new Date(Date.now() - 8 * 864e5) } });
  assert.ok(!(await riya.get(`${url}/conversations`).expect(200)).body.outgoing.some((x: { id: string }) => x.id === ign.id));
});

test('the sixth request of the day → 429; post-linked messages do not count', async () => {
  const me = 's2';
  const sender = await as(me);
  const targets = await strangers(me, false);
  const used = await db.conversation.count({ where: { fromId: me, postId: null, createdAt: { gte: new Date(Date.now() - 864e5) } } });
  const left = Math.max(0, 5 - used);
  for (const t of targets.slice(0, left)) await sender.post(`${url}/conversations`).send({ toId: t, note: 'hi' }).expect(201);
  await sender.post(`${url}/board-posts/bp8/message`).expect(201);
  const r = await sender.post(`${url}/conversations`).send({ toId: targets[left], note: 'one too many' }).expect(429);
  assert.equal(r.body.error.code, 'RATE_LIMITED');
});

test('a blocked user (either way) can neither request nor message', async () => {
  const [x, y] = await strangers('s3', false);
  await db.block.create({ data: { userId: x, blockedId: 's3' } });
  const s3 = await as('s3');
  assert.equal((await s3.post(`${url}/conversations`).send({ toId: x, note: 'hi' }).expect(403)).body.error.code, 'BLOCKED');
  assert.equal((await (await as(x)).post(`${url}/conversations`).send({ toId: 's3', note: 'hi' }).expect(403)).body.error.code, 'BLOCKED');
  const bp = await db.boardPost.findFirstOrThrow({ where: { authorId: x, kind: { in: ['gig', 'market', 'lost', 'found'] } } }).catch(() => null);
  if (bp) await s3.post(`${url}/board-posts/${bp.id}/message`).expect(403);
  // A block placed after a conversation opened stops further messages.
  const c = await db.conversation.create({ data: { fromId: 's3', toId: y, note: 'hey', state: 'accepted' } });
  await s3.post(`${url}/conversations/${c.id}/messages`).send({ body: 'ok' }).expect(201);
  await db.block.create({ data: { userId: y, blockedId: 's3' } });
  await s3.post(`${url}/conversations/${c.id}/messages`).send({ body: 'still?' }).expect(403);
});
