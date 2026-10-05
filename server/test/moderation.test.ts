import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { liftExpiredBans } from '../src/jobs.js';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

before(resetDb);
after(() => db.$disconnect());

const api = '/api/v1';
const as = async (id: string) => agent((await db.user.findUniqueOrThrow({ where: { id } })).email);
const feedIds = async (a: Awaited<ReturnType<typeof agent>>) => (await a.get(`${api}/commons/board-posts?limit=100`).expect(200)).body.items.map((p: { id: string }) => p.id);
const reportTimes = async (targetType: 'board' | 'project', targetId: string, ownerId: string, n: number) => {
  const rs = await db.user.findMany({ where: { role: 'student', status: 'active', id: { not: ownerId } }, orderBy: { id: 'asc' }, take: n });
  for (const r of rs) await db.report.create({ data: { reporterId: r.id, targetType, targetId, reason: 'Spam' } });
};

test('non-admins get 403 on every route', async () => {
  const s = await agent('student');
  for (const [m, u] of [['post', '/admin/reports/x'], ['patch', '/admin/commons/project/pr1'], ['post', '/admin/commons/project/pr1/unhide'], ['delete', '/admin/commons/project/pr1'], ['post', '/admin/users/s2/ban'], ['delete', '/admin/users/s2/ban'], ['get', '/admin/conversations'], ['get', '/admin/conversations/x/messages']] as const)
    await s[m](api + u).send({}).expect(403);
  await (await agent('teacher')).get(`${api}/admin/conversations`).expect(403);
});

test('hide removes the post from the feed, resolves reports; dismiss un-hides; warn notifies; all audited', async () => {
  const a = await agent('admin');
  const post = await db.boardPost.findFirstOrThrow({ where: { hiddenAt: null, kind: { not: 'gig' }, expiresAt: { gte: new Date() } }, orderBy: { id: 'asc' } });
  const viewer = await as((await db.user.findFirstOrThrow({ where: { role: 'student', status: 'active', id: { not: post.authorId } }, orderBy: { id: 'asc' } })).id);
  assert.ok((await feedIds(viewer)).includes(post.id));
  await reportTimes('board', post.id, post.authorId, 2);
  const r = await db.report.findFirstOrThrow({ where: { targetId: post.id } });
  await a.post(`${api}/admin/reports/${r.id}`).send({ action: 'nope' }).expect(422);
  await a.post(`${api}/admin/reports/${r.id}`).send({ action: 'hide' }).expect(200, { id: r.id, state: 'hidden' });
  assert.ok(!(await feedIds(viewer)).includes(post.id));
  assert.equal(await db.report.count({ where: { targetId: post.id, state: 'open' } }), 0);
  await a.post(`${api}/admin/reports/${r.id}`).send({ action: 'hide' }).expect(409);
  assert.ok(await db.auditLog.findFirst({ where: { action: 'report.hide', targetId: post.id } }));

  await a.post(`${api}/admin/commons/board-post/${post.id}/unhide`).expect(200);
  assert.ok((await feedIds(viewer)).includes(post.id));

  // auto-hidden then dismissed: shown again, report dismissed
  await db.boardPost.update({ where: { id: post.id }, data: { hiddenAt: new Date() } });
  const r2 = await db.report.create({ data: { reporterId: viewer.user.id, targetType: 'board', targetId: post.id, reason: 'Other' } });
  await a.post(`${api}/admin/reports/${r2.id}`).send({ action: 'dismiss' }).expect(200, { id: r2.id, state: 'dismissed' });
  assert.equal((await db.boardPost.findUniqueOrThrow({ where: { id: post.id } })).hiddenAt, null);

  const r3 = await db.report.create({ data: { reporterId: viewer.user.id, targetType: 'board', targetId: post.id, reason: 'Other' } });
  await a.post(`${api}/admin/reports/${r3.id}`).send({ action: 'warn' }).expect(200);
  assert.ok(await db.notification.findFirst({ where: { userId: post.authorId, type: 'warning' } }));
});

test('report delete removes the project; profile reports cannot be hidden', async () => {
  const a = await agent('admin');
  const p = await db.project.findFirstOrThrow({ where: { flagship: false, featured: false }, orderBy: { id: 'desc' } });
  const rep = await db.user.findFirstOrThrow({ where: { role: 'student', id: { not: p.ownerId } } });
  const r = await db.report.create({ data: { reporterId: rep.id, targetType: 'project', targetId: p.id, reason: 'Spam' } });
  await a.post(`${api}/admin/reports/${r.id}`).send({ action: 'delete' }).expect(200);
  assert.equal(await db.project.count({ where: { id: p.id } }), 0);
  const pr = await db.report.create({ data: { reporterId: rep.id, targetType: 'profile', targetId: p.ownerId, reason: 'Other' } });
  await a.post(`${api}/admin/reports/${pr.id}`).send({ action: 'hide' }).expect(422);
});

test('PATCH edits with before/after audit; unhide/delete; bad input 422', async () => {
  const a = await agent('admin');
  const p = await db.project.findFirstOrThrow({ where: { flagship: false }, orderBy: { id: 'asc' } });
  await a.patch(`${api}/admin/commons/project/${p.id}`).send({}).expect(422);
  await a.patch(`${api}/admin/commons/project/${p.id}`).send({ title: '' }).expect(422);
  await a.patch(`${api}/admin/commons/project/nope`).send({ title: 'x' }).expect(404);
  await a.patch(`${api}/admin/commons/project/${p.id}`).send({ title: 'Edited by admin' }).expect(200);
  const log = await db.auditLog.findFirstOrThrow({ where: { action: 'commons.edit', targetId: p.id } });
  assert.deepEqual(log.before, { title: p.title });
  assert.deepEqual(log.after, { title: 'Edited by admin' });
  await a.post(`${api}/admin/commons/profile/${p.ownerId}/unhide`).expect(422);
  await a.patch(`${api}/admin/commons/profile/${p.ownerId}`).send({ headline: 'Moderated' }).expect(200);
  await a.delete(`${api}/admin/commons/project/${p.id}`).expect(204);
  assert.ok(await db.auditLog.findFirst({ where: { action: 'commons.delete', targetId: p.id } }));
  await a.delete(`${api}/admin/commons/project/${p.id}`).expect(404);
});

test('a ban blocks the Commons but not the class; lifting restores; audited with reason', async () => {
  const a = await agent('admin');
  const riya = await agent('student');
  await riya.get(`${api}/commons/board-posts`).expect(200);
  await a.post(`${api}/admin/users/s1/ban`).send({}).expect(422);
  await a.post(`${api}/admin/users/t1/ban`).send({ reason: 'x' }).expect(404); // students only
  await a.post(`${api}/admin/users/s1/ban`).send({ reason: 'Harassment', until: '2030-01-01T00:00:00.000Z' }).expect(200);
  const blocked = await riya.get(`${api}/commons/board-posts`).expect(403);
  assert.equal(blocked.body.error.code, 'BANNED');
  await riya.get(`${api}/classes/${riya.user.homeClassId}/posts`).expect(200); // class space unaffected
  const log = await db.auditLog.findFirstOrThrow({ where: { action: 'user.ban', targetId: 's1' } });
  assert.equal((log.after as { reason: string }).reason, 'Harassment');
  await a.delete(`${api}/admin/users/s1/ban`).expect(204);
  await riya.get(`${api}/commons/board-posts`).expect(200);
  assert.ok(await db.auditLog.findFirst({ where: { action: 'user.unban', targetId: 's1' } }));
});

test('reading a conversation writes an audit row; listing filters; admin cannot post', async () => {
  const a = await agent('admin');
  const [x, y] = await db.user.findMany({ where: { role: 'student', status: 'active' }, orderBy: { id: 'asc' }, take: 2 });
  const c = await db.conversation.create({ data: { fromId: x!.id, toId: y!.id, note: 'hello there', state: 'accepted' } });
  await db.message.create({ data: { conversationId: c.id, senderId: x!.id, body: 'secret sauce' } });
  const list = await a.get(`${api}/admin/conversations?userId=${y!.id}&q=sauce`).expect(200);
  assert.deepEqual(list.body.items.map((i: { id: string }) => i.id), [c.id]);
  assert.equal((await a.get(`${api}/admin/conversations?q=zzzznothing`).expect(200)).body.items.length, 0);
  assert.equal(await db.auditLog.count({ where: { action: 'conversation.read' } }), 0);
  const r = await a.get(`${api}/admin/conversations/${c.id}/messages`).expect(200);
  assert.equal(r.body.items[0].body, 'secret sauce');
  const log = await db.auditLog.findFirstOrThrow({ where: { action: 'conversation.read', targetId: c.id } });
  assert.equal(log.actorId, a.user.id);
  await a.get(`${api}/admin/conversations/nope/messages`).expect(404);
  await a.post(`${api}/commons/conversations/${c.id}/messages`).send({ body: 'hi' }).expect(403); // read-only
});

test('a ban with an end date lifts itself: on the next request, and via the hourly job', async () => {
  const a = await agent('admin');
  const riya = await agent('student');
  await a.post(`${api}/admin/users/s1/ban`).send({ reason: 'Cool off', until: '2030-01-01T00:00:00.000Z' }).expect(200);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: 's1' } })).bannedUntil?.toISOString(), '2030-01-01T00:00:00.000Z');
  await riya.get(`${api}/commons/board-posts`).expect(403);
  await db.user.update({ where: { id: 's1' }, data: { bannedUntil: new Date(Date.now() - 1000) } }); // the end date passes
  await riya.get(`${api}/commons/board-posts`).expect(200);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: 's1' } })).bannedAt, null);

  await db.user.update({ where: { id: 's2' }, data: { bannedAt: new Date(), bannedUntil: new Date(Date.now() - 1000) } });
  assert.equal(await liftExpiredBans(new Date()), 1);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: 's2' } })).bannedAt, null);
});
