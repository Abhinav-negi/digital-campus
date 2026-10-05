import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

before(resetDb);
after(() => db.$disconnect());

// Seed: pr0 (flagship), pr1, pr3 are featured = 3 of 3 used.
test('GET lists flags and used/3; non-admin → 403', async () => {
  const a = await agent('admin');
  const r = await a.get('/api/v1/admin/featured').expect(200);
  assert.equal(r.body.used, 3);
  assert.equal(r.body.max, 3);
  assert.equal(r.body.projects.find((p: { id: string }) => p.id === 'pr0').flagship, true);
  await (await agent('teacher')).get('/api/v1/admin/featured').expect(403);
});

test('a fourth feature → 409; unstar one first then it works; audited', async () => {
  const a = await agent('admin');
  await a.put('/api/v1/admin/featured/project/pr2').send({ featured: true }).expect(409);
  await a.put('/api/v1/admin/featured/project/pr1').send({ featured: false }).expect(200, { id: 'pr1', featured: false });
  const ch = await db.challenge.findFirstOrThrow();
  await a.put(`/api/v1/admin/featured/challenge/${ch.id}`).send({ featured: true }).expect(200);
  await a.put('/api/v1/admin/featured/project/pr2').send({ featured: true }).expect(409); // challenges share the cap
  assert.ok(await db.auditLog.findFirst({ where: { targetId: 'pr1', action: 'featured.unset' } }));
  await a.put('/api/v1/admin/featured/project/nope').send({ featured: true }).expect(404);
  await a.put('/api/v1/admin/featured/project/pr0').send({ featured: false }).expect(409); // flagship can't be (un)starred
});

test('setting the flagship moves the flag', async () => {
  const a = await agent('admin');
  await a.put('/api/v1/admin/featured/challenge/' + (await db.challenge.findFirstOrThrow()).id).send({ featured: false }).expect(200);
  await a.put('/api/v1/admin/flagship').send({ projectId: 'pr2' }).expect(200, { projectId: 'pr2' });
  const flags = await db.project.findMany({ where: { flagship: true }, select: { id: true } });
  assert.deepEqual(flags, [{ id: 'pr2' }]);
  assert.ok(await db.auditLog.findFirst({ where: { targetId: 'pr2', action: 'flagship.set' } }));
  await a.put('/api/v1/admin/flagship').send({ projectId: 'nope' }).expect(404);
});
