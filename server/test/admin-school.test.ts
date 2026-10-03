import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import request from 'supertest';
import { db } from '../src/lib/db.js';
import { errorHandler } from '../src/lib/http.js';
import { branchesRouter } from '../src/modules/admin/school.js';
import { agent, resetDb } from './helpers.js';

before(resetDb);
after(() => db.$disconnect());

// GET /branches isn't in app.ts yet (orchestrator wires `['/branches', branchesRouter]`), so mount it here.
const picker = express().use('/branches', branchesRouter).use(errorHandler);

test('institution: read, update (audited), bad time zone → 422', async () => {
  const a = await agent('admin');
  const { body } = await a.get('/api/v1/admin/institution').expect(200);
  assert.equal(body.id, 'i1');
  await a.patch('/api/v1/admin/institution').send({ timezone: 'Mars/Olympus' }).expect(422);
  const updated = await a.patch('/api/v1/admin/institution').send({ name: 'Renamed Institute' }).expect(200);
  assert.equal(updated.body.name, 'Renamed Institute');
  assert.equal(updated.body.timezone, body.timezone);
  assert.ok(await db.auditLog.findFirst({ where: { targetId: 'i1', action: 'institution.update' } }));
  await (await agent('teacher')).get('/api/v1/admin/institution').expect(403);
});

test('a new branch appears in the class-create picker; duplicate code → 409; rename works', async () => {
  const a = await agent('admin');
  const created = await a.post('/api/v1/admin/branches').send({ code: 'ai', name: 'Artificial Intelligence' }).expect(201);
  assert.equal(created.body.code, 'AI');
  await a.post('/api/v1/admin/branches').send({ code: 'AI', name: 'Again' }).expect(409);
  await a.patch(`/api/v1/admin/branches/${created.body.id}`).send({ code: 'cse' }).expect(409);
  await a.patch(`/api/v1/admin/branches/${created.body.id}`).send({ name: 'AI & DS' }).expect(200);

  const teacher = await agent('teacher');
  const { body } = await request(picker).get('/branches').auth(teacher.token, { type: 'bearer' }).expect(200);
  assert.ok(body.items.some((b: { id: string; name: string }) => b.id === created.body.id && b.name === 'AI & DS'));
  await request(picker).get('/branches').expect(401);

  const list = await a.get('/api/v1/admin/branches').expect(200);
  assert.equal(list.body.items.find((b: { id: string }) => b.id === created.body.id).classCount, 0);
  assert.ok(list.body.items.find((b: { id: string }) => b.id === 'cse').classCount > 0);
});

test('deleting a used branch → 409; an unused one → 204 (audited)', async () => {
  const a = await agent('admin');
  await a.delete('/api/v1/admin/branches/cse').expect(409);
  const { body } = await a.post('/api/v1/admin/branches').send({ code: 'TMP', name: 'Temporary' }).expect(201);
  await a.delete(`/api/v1/admin/branches/${body.id}`).expect(204);
  assert.equal(await db.branch.count({ where: { id: body.id } }), 0);
  assert.ok(await db.auditLog.findFirst({ where: { targetId: body.id, action: 'branch.delete' } }));
  await a.delete('/api/v1/admin/branches/nope').expect(404);
});
