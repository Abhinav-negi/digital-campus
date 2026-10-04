import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

// Seed: Sana (t3) teaches c1 + c3, not c2. s2 is a plain c1 student, s51 is c3's CR, s31 is c2's CR.
before(resetDb);
after(() => db.$disconnect());

const as = async (id: string) => agent((await db.user.findUniqueOrThrow({ where: { id } })).email);
const activeStudents = (classIds: string[]) =>
  db.user.count({ where: { role: 'student', status: 'active', memberships: { some: { classId: { in: classIds }, role: { in: ['student', 'cr'] } } } } });
const post = { kind: 'announcement', title: 'Bring calculators', body: 'Physics test next week: bring calculators.' };

test('targets: a teacher not in a class → 403; one post to 2 classes is visible in both, students notified', async () => {
  const t3 = await agent('outsider');
  await t3.post('/api/v1/posts').send({ ...post, classIds: ['c1', 'c2'] }).expect(403);
  await t3.post('/api/v1/posts').send({ ...post, classIds: ['c1', 'nope'] }).expect(404);
  await t3.post('/api/v1/posts').send({ ...post, kind: 'assignment', classIds: ['c1'] }).expect(422); // no due date
  await t3.post('/api/v1/posts').send({ ...post, classIds: ['c1'], fileKey: 'uploads/t1/abc-x.pdf' }).expect(422); // someone else's upload
  await (await as('s2')).post('/api/v1/posts').send({ ...post, classIds: ['c1'] }).expect(403); // students can't post

  const p = (await t3.post('/api/v1/posts').send({ ...post, classIds: ['c1', 'c3', 'c1'], fileKey: 'uploads/t3/abc-sheet.pdf' }).expect(201)).body;
  assert.deepEqual(p.classes.map((c: { id: string }) => c.id).sort(), ['c1', 'c3']);
  assert.match(p.fileUrl, /uploads\/t3\/abc-sheet\.pdf\?exp=/);
  assert.equal(p.stats.total, await activeStudents(['c1', 'c3']));

  for (const [who, classId] of [['s2', 'c1'], ['s51', 'c3']] as const) {
    const items = (await (await as(who)).get(`/api/v1/classes/${classId}/posts`).expect(200)).body.items;
    assert.equal(items[0].id, p.id); // newest first
    assert.equal(items[0].seen, false);
    assert.ok(await db.notification.findFirst({ where: { userId: who, type: 'post', payload: { path: ['postId'], equals: p.id } } }));
  }
  assert.ok(!(await (await as('s31')).get('/api/v1/classes/c2/posts').expect(200)).body.items.some((x: { id: string }) => x.id === p.id));
  await (await as('s31')).get('/api/v1/classes/c1/posts').expect(403);
  await request(app).get('/api/v1/classes/c1/posts').expect(401);
});

test('seen counts, remind hits only the unseen, /posts/mine', async () => {
  const t3 = await agent('outsider');
  const p = (await t3.post('/api/v1/posts').send({ ...post, kind: 'assignment', dueAt: '2026-12-10', classIds: ['c1', 'c3'] }).expect(201)).body;
  assert.equal(p.dueAt, '2026-12-10T00:00:00.000Z');
  const s2 = await as('s2');
  await s2.post(`/api/v1/posts/${p.id}/seen`).expect(204);
  await s2.post(`/api/v1/posts/${p.id}/seen`).expect(204); // idempotent
  await (await as('s51')).post(`/api/v1/posts/${p.id}/seen`).expect(204);
  await (await as('s31')).post(`/api/v1/posts/${p.id}/seen`).expect(404); // c2 isn't a target
  await t3.post(`/api/v1/posts/${p.id}/seen`).expect(403); // students only

  assert.equal((await s2.get('/api/v1/classes/c1/posts').expect(200)).body.items[0].seen, true);
  const inC1 = (await t3.get('/api/v1/classes/c1/posts').expect(200)).body.items[0];
  assert.deepEqual([inC1.seen, inC1.stats], [null, { seen: 1, total: await activeStudents(['c1']) }]);

  await (await agent('teacher')).post(`/api/v1/posts/${p.id}/remind`).expect(403); // not the author
  const total = await activeStudents(['c1', 'c3']);
  const { reminded } = (await t3.post(`/api/v1/posts/${p.id}/remind`).expect(200)).body;
  const muted = await db.user.count({ where: { id: { notIn: ['s2', 's51'] }, mutedTypes: { has: 'post' }, role: 'student', status: 'active', memberships: { some: { classId: { in: ['c1', 'c3'] } } } } });
  assert.equal(reminded, total - 2 - muted);
  const reminders = (id: string) => db.notification.count({ where: { userId: id, type: 'post', payload: { path: ['postId'], equals: p.id } } });
  assert.equal(await reminders('s2'), 1); // the original post only
  assert.equal(await reminders('s3'), 2); // post + reminder
  assert.equal(await db.auditLog.count({ where: { targetId: p.id, action: 'post.remind' } }), 2); // one per class

  const mine = (await t3.get('/api/v1/posts/mine').expect(200)).body.items;
  assert.deepEqual(mine[0].stats, { seen: 2, total });
  assert.ok(mine.every((x: { author: { id: string } }) => x.author.id === 't3'));
  await s2.get('/api/v1/posts/mine').expect(403);
});
