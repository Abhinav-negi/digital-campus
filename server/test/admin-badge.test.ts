import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

before(resetDb);
after(() => db.$disconnect());

test('grant → the user passes admin(), is notified and audited; revoke → 403 again', async () => {
  const a = await agent('admin');
  const t2 = await agent('subjectTeacher');
  await t2.get('/api/v1/admin/users').expect(403);
  await a.put('/api/v1/admin/users/t2/admin').send({ isAdmin: true }).expect(200, { id: 't2', isAdmin: true });
  await t2.get('/api/v1/admin/users').expect(200);
  assert.ok(await db.notification.findFirst({ where: { userId: 't2', type: 'admin-badge' } }));
  assert.ok(await db.auditLog.findFirst({ where: { targetId: 't2', action: 'user.admin.grant' } }));
  // The new admin can revoke their own badge (the chief remains an admin).
  await t2.put('/api/v1/admin/users/t2/admin').send({ isAdmin: false }).expect(200);
  await t2.get('/api/v1/admin/users').expect(403);
});

test("revoking the chief's badge → 409; granting to a student → 422; unknown → 404; non-admin → 403", async () => {
  const a = await agent('admin');
  await a.put('/api/v1/admin/users/a1/admin').send({ isAdmin: false }).expect(409);
  await a.put('/api/v1/admin/users/s1/admin').send({ isAdmin: true }).expect(422);
  await a.put('/api/v1/admin/users/nope/admin').send({ isAdmin: true }).expect(404);
  await (await agent('teacher')).put('/api/v1/admin/users/t1/admin').send({ isAdmin: true }).expect(403);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: 'a1' } })).isAdmin, true);
});
