import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

before(resetDb);
after(() => db.$disconnect());

const url = '/api/v1/commons';
const as = async (id: string) => agent((await db.user.findUniqueOrThrow({ where: { id } })).email);
const notes = (userId: string, type: string) => db.notification.count({ where: { userId, type } });

test('list: flagship, featured strip, the rest; cross-branch computed; no emails', async () => {
  const riya = await agent('student');
  const res = await riya.get(`${url}/projects`).expect(200);
  const { flagship, featured, all } = res.body;
  assert.equal(flagship.id, 'pr0');
  assert.equal(flagship.me, 'member');
  assert.ok(flagship.crossBranch && flagship.branches.length >= 2);
  assert.ok(featured.every((p: { featured: boolean; community: boolean }) => p.featured || p.community));
  assert.equal(featured[0].featured, true);
  assert.ok(!all.some((p: { id: string }) => p.id === 'pr0'));
  const solo = all.find((p: { id: string }) => p.id === 'pr6') ?? featured.find((p: { id: string }) => p.id === 'pr6');
  assert.equal(solo.members[0].role, 'Owner');
  assert.equal(featured.find((p: { id: string }) => p.id === 'pr1').me, 'member');
  assert.ok(!JSON.stringify(res.body).includes('@'));
  await (await agent('teacher')).get(`${url}/projects`).expect(403);
});

test('create, join, accept: the team crosses branches; requests are owner-only', async () => {
  const riya = await agent('student');
  await riya.post(`${url}/projects`).send({ title: 'x', description: 'y', repoUrl: 'javascript:alert(1)' }).expect(422);
  await (await agent('admin')).post(`${url}/projects`).send({ title: 'x', description: 'y' }).expect(403);
  const p = (await riya.post(`${url}/projects`).send({ title: 'Robot arm', description: 'Pick and place', roles: ['CAD'], repoUrl: 'https://github.com/r/arm' }).expect(201)).body;
  assert.equal(p.mine, true);
  assert.equal(p.status, 'looking');
  assert.deepEqual(p.members.map((m: { id: string }) => m.id), ['s1']);
  assert.equal(p.crossBranch, false);

  const me = await db.user.findUniqueOrThrow({ where: { id: 's1' }, select: { homeClass: { select: { branchId: true } } } });
  const other = await db.user.findFirstOrThrow({ where: { role: 'student', status: 'active', homeClass: { branchId: { not: me.homeClass!.branchId } } } });
  const them = await agent(other.email);
  const joined = (await them.post(`${url}/projects/${p.id}/join`).send({ note: 'I do CAD' }).expect(201)).body;
  assert.equal(joined.me, 'requested');
  assert.deepEqual(joined.requests, []);
  await them.post(`${url}/projects/${p.id}/join`).send({}).expect(409); // duplicate pending
  await them.post(`${url}/projects/${p.id}/updates`).send({ body: 'hi' }).expect(403); // not a member yet

  const mine = (await riya.get(`${url}/projects/${p.id}`).expect(200)).body;
  assert.equal(mine.requests.length, 1);
  assert.equal(mine.requests[0].note, 'I do CAD');
  const n = await notes(other.id, 'project-join-reply');
  await them.post(`${url}/join-requests/${mine.requests[0].id}`).send({ state: 'accepted' }).expect(403); // not the owner
  const after = (await riya.post(`${url}/join-requests/${mine.requests[0].id}`).send({ state: 'accepted' }).expect(200)).body;
  assert.equal(after.crossBranch, true);
  assert.equal(after.members.length, 2);
  assert.equal(await notes(other.id, 'project-join-reply'), n + 1);
  await riya.post(`${url}/join-requests/${mine.requests[0].id}`).send({ state: 'declined' }).expect(409); // already answered
  await them.post(`${url}/projects/${p.id}/join`).send({}).expect(409); // already a member

  const upd = (await them.post(`${url}/projects/${p.id}/updates`).send({ body: 'Base plate printed' }).expect(201)).body;
  assert.equal(upd.updates[0].body, 'Base plate printed');
  assert.equal(upd.updates[0].source, 'manual');

  await them.patch(`${url}/projects/${p.id}`).send({ status: 'building' }).expect(403);
  const patched = (await riya.patch(`${url}/projects/${p.id}`).send({ status: 'shipped', repoUrl: null }).expect(200)).body;
  assert.equal(patched.status, 'shipped');
  assert.equal(patched.repoUrl, null);
  await them.delete(`${url}/projects/${p.id}`).expect(403);
  await riya.delete(`${url}/projects/${p.id}`).expect(204);
  await riya.get(`${url}/projects/${p.id}`).expect(404);
});

test('seeded requests: a non-owner member cannot accept; the owner notifies on join', async () => {
  const s7 = await as('s7'); // on pr1's team, not its owner
  await s7.post(`${url}/join-requests/jr1`).send({ state: 'accepted' }).expect(403);
  await (await as('s14')).post(`${url}/projects/pr1/join`).send({}).expect(409); // jr1 is still pending
  const n = await notes('s1', 'project-join');
  await (await as('s12')).post(`${url}/projects/pr1/join`).send({}).expect(201);
  assert.equal(await notes('s1', 'project-join'), n + 1);
  await (await as('s14')).get(`${url}/projects/pr1`).expect(200).then((r) => assert.equal(r.body.me, 'requested'));
});

test('hidden projects: out of the list, 404 for others', async () => {
  await db.project.update({ where: { id: 'pr2' }, data: { hiddenAt: new Date() } });
  const riya = await agent('student');
  const { body } = await riya.get(`${url}/projects`).expect(200);
  assert.ok(![...body.featured, ...body.all].some((p: { id: string }) => p.id === 'pr2'));
  await riya.get(`${url}/projects/pr2`).expect(404);
  await (await as('s12')).get(`${url}/projects/pr2`).expect(200); // its owner
});
