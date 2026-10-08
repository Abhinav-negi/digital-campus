import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { addDays, today } from '../src/lib/dates.js';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

before(resetDb);
after(() => db.$disconnect());

const url = '/api/v1/commons/board-posts';
/** A logged-in agent for any seeded user id. */
const as = async (id: string) => agent((await db.user.findUniqueOrThrow({ where: { id } })).email);
const authorOf = async (postId: string) => (await db.boardPost.findUniqueOrThrow({ where: { id: postId } })).authorId;
type Card = { id: string; kind: string; status: string; createdAt: string; author: { name: string; label: string | null; otherBranch: boolean } };

test('the sixth post in a day → 429; the cap counts by the institution day', async () => {
  const riya = await agent('student');
  const ask = (n: number) => riya.post(url).send({ kind: 'ask', title: `Question ${n}`, tags: ['DSA'] });
  for (let n = 1; n <= 5; n++) await ask(n).expect(201);
  const res = await ask(6).expect(429);
  assert.equal(res.body.error.message, 'You have used your 5 posts for today');

  // A post from the previous institution day no longer counts.
  const mine = await db.boardPost.findFirstOrThrow({ where: { authorId: 's1', title: 'Question 1' } });
  await db.boardPost.update({ where: { id: mine.id }, data: { createdAt: new Date(Date.now() - 25 * 3_600_000) } });
  await ask(7).expect(201);
});

test('create: per-kind forms, expiry, validation; teachers and admins cannot post', async () => {
  const s = await as('s3');
  const on = today();
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const ask = (await s.post(url).send({ kind: 'ask', title: 'Best DSA book?', body: 'For 2nd year', tags: ['DSA'] }).expect(201)).body;
  assert.equal(ask.expiresAt, ymd(addDays(on, 14)));
  assert.equal(ask.status, 'open');
  assert.deepEqual(ask.actions.sort(), ['answer', 'delete', 'extend', 'solved']);
  const gig = (await s.post(url).send({ kind: 'gig', title: 'Logo', body: 'SVG', price: 300, deadline: ymd(addDays(on, 5)) }).expect(201)).body;
  assert.equal(gig.expiresAt, ymd(addDays(on, 5)));
  assert.equal(gig.priceType, 'fixed');
  const found = (await s.post(url).send({ kind: 'found', title: 'Keys', place: 'LH-1', holder: 'With me', hiddenDetail: 'red tag' }).expect(201)).body;
  assert.equal(found.expiresAt, ymd(addDays(on, 30)));
  assert.equal(found.happenedOn, ymd(on));
  assert.equal(found.hiddenDetail, 'red tag');

  await s.post(url).send({ kind: 'gig', title: 'Late', body: 'x', price: 1, deadline: ymd(addDays(on, -1)) }).expect(422);
  await s.post(url).send({ kind: 'market', title: 'Bike', price: 10, condition: 'Mint', marketType: 'sell' }).expect(422);
  await s.post(url).send({ kind: 'found', title: 'Keys', place: 'LH-1', holder: 'me' }).expect(422); // no hidden detail
  await s.post(url).send({ kind: 'ask', title: 'x'.repeat(141) }).expect(422);
  await (await agent('teacher')).post(url).send({ kind: 'ask', title: 'Hi' }).expect(403);
  await (await agent('admin')).post(url).send({ kind: 'ask', title: 'Hi' }).expect(403);
});

test('feed: live only (expired and hidden posts drop out), kind/branch/q filters, closed after open on the same day; no email', async () => {
  const riya = await agent('student');
  await db.boardPost.update({ where: { id: 'bp3' }, data: { expiresAt: addDays(today(), -1) } }); // expired yesterday
  await db.boardPost.update({ where: { id: 'bp1' }, data: { expiresAt: today() } }); // last day: still live
  await db.boardPost.update({ where: { id: 'bp7' }, data: { hiddenAt: new Date() } });

  const all: Card[] = (await riya.get(`${url}?limit=100`).expect(200)).body.items;
  const ids = all.map((p) => p.id);
  assert.ok(!ids.includes('bp3'), 'expired');
  assert.ok(!ids.includes('bp7'), 'hidden');
  assert.ok(ids.includes('bp1'), 'expires today = still live');
  const json = JSON.stringify(all);
  assert.doesNotMatch(json, /"email"|@/);
  assert.doesNotMatch(json, /hiddenDetail|name sticker/);
  // Newest institution day first; on the same day, open before closed.
  const day = (p: Card) => today(undefined, new Date(p.createdAt)).getTime();
  const closed = (p: Card) => +['solved', 'sold', 'given', 'returned', 'done'].includes(p.status);
  for (let i = 1; i < all.length; i++) {
    const [a, b] = [all[i - 1]!, all[i]!];
    assert.ok(day(a) > day(b) || (day(a) === day(b) && closed(a) <= closed(b)), `${a.id} before ${b.id}`);
  }
  const bp12 = all.find((p) => p.id === 'bp12')!;
  assert.match(bp12.author.label!, /^ME · 4th year$/);
  assert.equal(bp12.author.otherBranch, true);

  const lf: Card[] = (await riya.get(`${url}?kind=lf&limit=100`).expect(200)).body.items;
  assert.ok(lf.length > 0 && lf.every((p) => p.kind === 'lost' || p.kind === 'found'));
  const ece: Card[] = (await riya.get(`${url}?branchId=ece&limit=100`).expect(200)).body.items;
  assert.ok(ece.length > 0 && ece.every((p) => p.author.label?.startsWith('ECE')));
  const esp: Card[] = (await riya.get(`${url}?q=esp32`).expect(200)).body.items;
  assert.deepEqual(esp.map((p) => p.id), ['bp2']);
  const counted = (await riya.get(`${url}?kind=ask&limit=100`).expect(200)).body.items.find((p: Card) => p.id === 'bp14');
  assert.equal(counted.count, 1);

  // The cursor walks the whole list without repeats.
  const walked: string[] = [];
  let cursor: string | null = null;
  do {
    const res = await riya.get(url).query({ limit: 4, ...(cursor && { cursor }) }).expect(200);
    walked.push(...res.body.items.map((p: Card) => p.id));
    cursor = res.body.nextCursor;
  } while (cursor);
  assert.deepEqual(walked, ids);

  await (await agent('teacher')).get(url).expect(403);
  await (await agent('admin')).get(url).expect(200);
});

test('hiddenDetail never leaks to non-authors; the author and admins see it', async () => {
  const finder = await authorOf('bp12');
  const riya = await agent('student');
  const seen = (await riya.get(`${url}/bp12`).expect(200)).body;
  assert.equal(seen.hiddenDetail, null);
  assert.doesNotMatch(JSON.stringify(seen), /name sticker|"email"/);
  assert.ok(seen.actions.includes('claim'));
  // Riya's own claim answer is the only claim she sees.
  await riya.post(`${url}/bp12/claims`).send({ answer: 'a name sticker on the back' }).expect(201);
  const other = (await (await as('s3')).get(`${url}/bp12`).expect(200)).body;
  assert.equal(other.claims.length, 0);
  assert.doesNotMatch(JSON.stringify(other), /name sticker/);

  assert.equal((await (await as(finder)).get(`${url}/bp12`).expect(200)).body.hiddenDetail, 'name sticker on the back');
  assert.equal((await (await agent('admin')).get(`${url}/bp12`).expect(200)).body.hiddenDetail, 'name sticker on the back');
  await riya.get(`${url}/nope`).expect(404);
});

test('status: only the author, only valid transitions per kind (else 422); extend; delete', async () => {
  const riya = await agent('student'); // author of bp14 (ask)
  await riya.patch(`${url}/bp14/status`).send({ status: 'sold' }).expect(422);
  await riya.patch(`${url}/bp14/status`).send({ status: 'closed' }).expect(422);
  await (await as('s3')).patch(`${url}/bp14/status`).send({ status: 'solved' }).expect(403);
  assert.equal((await riya.patch(`${url}/bp14/status`).send({ status: 'solved' }).expect(200)).body.status, 'solved');
  await riya.patch(`${url}/bp14/status`).send({ status: 'solved' }).expect(422); // already closed
  await riya.post(`${url}/bp14/extend`).expect(422);

  const giver = await as(await authorOf('bp8')); // market · give
  await giver.patch(`${url}/bp8/status`).send({ status: 'sold' }).expect(422);
  await giver.patch(`${url}/bp8/status`).send({ status: 'given' }).expect(200);
  const gigger = await as(await authorOf('bp4')); // open gig: done only once assigned
  await gigger.patch(`${url}/bp4/status`).send({ status: 'done' }).expect(422);

  const lost = await as(await authorOf('bp11'));
  const before = (await lost.get(`${url}/bp11`).expect(200)).body.expiresAt;
  const after = (await lost.post(`${url}/bp11/extend`).expect(200)).body.expiresAt;
  assert.equal((Date.parse(after) - Date.parse(before)) / 86_400_000, 30);
  await riya.delete(`${url}/bp11`).expect(403);
  await lost.delete(`${url}/bp11`).expect(204);
  await lost.get(`${url}/bp11`).expect(404);
});

test('smart routing: a matching Ask notifies skilled students and helps-juniors seniors, at most once a day', async () => {
  await db.notification.deleteMany({ where: { type: 'board-match' } });
  const fresher = await as(await authorOf('bp1')); // ME 1st year
  await fresher.post(url).send({ kind: 'ask', title: 'React or Vue first?', tags: ['react'] }).expect(201);
  const got = await db.notification.findMany({ where: { type: 'board-match' } });
  assert.ok(got.some((n) => n.userId === 's1'), 'Riya: React skill and helps juniors');
  assert.ok(!got.some((n) => n.userId === (fresher.user.id)), 'not the poster');
  await fresher.post(url).send({ kind: 'gig', title: 'React tutor', body: '2 sessions', price: 200, deadline: today().toISOString().slice(0, 10), tags: ['React'] }).expect(201);
  assert.equal(await db.notification.count({ where: { type: 'board-match', userId: 's1' } }), 1);
});

test('mine=true: my expired post is there, nobody else\'s is', async () => {
  const riya = await agent('student');
  const mine = await db.boardPost.findFirstOrThrow({ where: { authorId: 's1' } });
  await db.boardPost.update({ where: { id: mine.id }, data: { expiresAt: addDays(today(), -5) } });
  const live: Card[] = (await riya.get(`${url}?limit=100`).expect(200)).body.items;
  assert.ok(!live.some((p) => p.id === mine.id));
  const items: (Card & { author: { id: string } })[] = (await riya.get(`${url}?mine=true&limit=100`).expect(200)).body.items;
  assert.ok(items.some((p) => p.id === mine.id));
  assert.ok(items.every((p) => p.author.id === 's1'));
});
