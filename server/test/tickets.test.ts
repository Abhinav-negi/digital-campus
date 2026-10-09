import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

before(resetDb);
after(() => db.$disconnect());

// Seed: tk1 is s8's attendance ticket; reports rp1..rp3 are open.
const s8 = async () => agent((await db.user.findUniqueOrThrow({ where: { id: 's8' } })).email);

test("a user opens and lists their own tickets; another user's ticket is a 404", async () => {
  const t = await agent('teacher');
  const created = await t.post('/api/v1/tickets').send({ category: 'bug', subject: 'Upload fails', body: 'PDF upload spins forever' }).expect(201);
  assert.equal(created.body.state, 'open');
  assert.equal(created.body.from.id, 't1');
  const mine = await t.get('/api/v1/tickets/mine').expect(200);
  assert.deepEqual(mine.body.items.map((i: { id: string }) => i.id), [created.body.id]);

  const s1 = await agent('student');
  await s1.get('/api/v1/tickets/tk1').expect(404);
  await s1.get(`/api/v1/tickets/${created.body.id}`).expect(404);
  await s1.post('/api/v1/tickets/tk1/replies').send({ body: 'hi' }).expect(404);
  await s1.get('/api/v1/tickets/nope').expect(404);
  assert.equal((await (await s8()).get('/api/v1/tickets/tk1').expect(200)).body.subject, 'Marked absent in Data Structures');

  await t.post('/api/v1/tickets').send({ category: 'bug', subject: 'x'.repeat(141), body: 'b' }).expect(422);
  await t.post('/api/v1/tickets').send({ category: 'nope', subject: 's', body: 'b' }).expect(422);
});

test('admin reply → answered, notified, audited; owner reply reopens; closed → 409; reopen', async () => {
  const a = await agent('admin');
  const owner = await s8();
  const r = await a.post('/api/v1/tickets/tk1/replies').send({ body: 'Fixed, you are marked present.' }).expect(201);
  assert.equal(r.body.state, 'answered');
  assert.equal(r.body.replies.at(-1).fromAdmin, true);
  assert.ok(await db.notification.findFirst({ where: { userId: 's8', type: 'ticket-reply', payload: { path: ['ticketId'], equals: 'tk1' } } }));
  assert.ok(await db.auditLog.findFirst({ where: { targetId: 'tk1', action: 'ticket.reply' } }));

  const back = await owner.post('/api/v1/tickets/tk1/replies').send({ body: 'Thanks, one more date too?' }).expect(201);
  assert.equal(back.body.state, 'open');
  assert.equal(back.body.replies.at(-1).fromAdmin, false);

  await owner.patch('/api/v1/admin/tickets/tk1').send({ state: 'closed' }).expect(403);
  await a.patch('/api/v1/admin/tickets/tk1').send({ state: 'closed' }).expect(200, { id: 'tk1', state: 'closed' });
  assert.ok(await db.auditLog.findFirst({ where: { targetId: 'tk1', action: 'ticket.close' } }));
  await owner.post('/api/v1/tickets/tk1/replies').send({ body: 'hello?' }).expect(409);
  await a.patch('/api/v1/admin/tickets/tk1').send({ state: 'open' }).expect(200, { id: 'tk1', state: 'open' });
  await a.patch('/api/v1/admin/tickets/nope').send({ state: 'closed' }).expect(404);
});

test('the inbox merges tickets and reports, newest first, with counts per state', async () => {
  const a = await agent('admin');
  const all = await a.get('/api/v1/admin/inbox').expect(200);
  const types = new Set(all.body.items.map((i: { type: string }) => i.type));
  assert.deepEqual(types, new Set(['ticket', 'report']));
  const times = all.body.items.map((i: { createdAt: string }) => Date.parse(i.createdAt));
  assert.deepEqual(times, [...times].sort((x, y) => y - x));
  assert.equal(all.body.counts.reports.open, await db.report.count({ where: { state: 'open' } }));
  assert.equal(all.body.counts.tickets.open, await db.ticket.count({ where: { state: 'open' } }));
  assert.equal(all.body.counts.tickets.answered, await db.ticket.count({ where: { state: 'answered' } }));

  const reports = await a.get('/api/v1/admin/inbox?type=reports').expect(200);
  assert.ok(reports.body.items.length > 0 && reports.body.items.every((i: { type: string }) => i.type === 'report'));
  // `closed` is a ticket-only state, so reports drop out of an `all` listing.
  await a.patch('/api/v1/admin/tickets/tk1').send({ state: 'closed' }).expect(200);
  const closed = await a.get('/api/v1/admin/inbox?state=closed').expect(200);
  assert.ok(closed.body.items.some((i: { id: string }) => i.id === 'tk1'));
  assert.ok(closed.body.items.every((i: { type: string; state: string }) => i.type === 'ticket' && i.state === 'closed'));
  await a.get('/api/v1/admin/inbox?state=bogus').expect(422);
  await (await agent('teacher')).get('/api/v1/admin/inbox').expect(403);
});

test('per-user write throttle (FND-10): the 31st ticket in a minute → 429, another user is unaffected', async () => {
  const t = await agent('subjectTeacher');
  const body = { category: 'bug', subject: 's', body: 'b' };
  for (let i = 0; i < 30; i++) await t.post('/api/v1/tickets').send(body).expect(201);
  assert.equal((await t.post('/api/v1/tickets').send(body).expect(429)).body.error.code, 'RATE_LIMITED');
  await (await agent('admin')).post('/api/v1/tickets').send(body).expect(201);
});
