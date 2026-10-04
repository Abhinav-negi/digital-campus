import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { addDays, today } from '../src/lib/dates.js';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

before(resetDb);
after(() => db.$disconnect());

type Entry = { id: string; action: string; actor: { id: string; name: string }; class: { id: string } | null; detail: string; createdAt: string };
const iso = (d: Date) => d.toISOString().slice(0, 10);

test('non-admins get 403', async () => {
  for (const who of ['teacher', 'student'] as const) {
    const a = await agent(who);
    await a.get('/api/v1/admin/audit').expect(403);
    await a.get('/api/v1/admin/overview').expect(403);
  }
});

test('audit: newest first with actor names and a readable detail; actor/class/action/date filters; cursor', async () => {
  const a = await agent('admin');
  await a.patch('/api/v1/admin/users/t2/status').send({ status: 'disabled' }).expect(200);
  const s = await db.user.findFirstOrThrow({ where: { homeClassId: 'c1', status: 'active', role: 'student' }, orderBy: { id: 'asc' } });
  await a.patch(`/api/v1/admin/students/${s.id}`).send({ name: 'Renamed Student' }).expect(200);
  const get = async (query: Record<string, string | number>) => (await a.get('/api/v1/admin/audit').query(query).expect(200)).body as { items: Entry[]; nextCursor: string | null };

  const all = await get({ limit: 100 });
  assert.ok(all.items.length > 2);
  assert.equal(all.items[0]!.action, 'student.update', 'newest first');
  for (let i = 1; i < all.items.length; i++) assert.ok(all.items[i - 1]!.createdAt >= all.items[i]!.createdAt);
  assert.ok(all.items.every((e) => e.actor.name && !e.detail.includes('{') && !e.detail.includes('"')), 'no JSON dumps');
  const rename = all.items[0]!;
  assert.equal(rename.detail, `Student update · name ${s.name} → Renamed Student`);
  assert.equal(rename.actor.name, (await db.user.findUniqueOrThrow({ where: { id: 'a1' } })).name);
  assert.equal(rename.class?.id, 'c1');

  const disable = await get({ action: 'user.disable' });
  assert.deepEqual(disable.items.map((e) => e.detail), ['User disable · status active → disabled']);
  assert.ok((await get({ action: 'student' })).items.every((e) => e.action.startsWith('student')), 'action is a prefix');

  const byActor = await get({ actorId: 't1', limit: 100 });
  assert.ok(byActor.items.length > 0 && byActor.items.every((e) => e.actor.id === 't1'));
  assert.equal(byActor.items.length, await db.auditLog.count({ where: { actorId: 't1' } }));
  const byClass = await get({ classId: 'c1', limit: 100 });
  assert.ok(byClass.items.some((e) => e.id === rename.id) && byClass.items.every((e) => e.class?.id === 'c1'));

  const day = today();
  assert.ok((await get({ from: iso(day), to: iso(day) })).items.some((e) => e.id === rename.id), "today's rows are in [today, today]");
  assert.ok(!(await get({ from: iso(addDays(day, 1)) })).items.some((e) => e.id === rename.id));
  assert.ok(!(await get({ to: iso(addDays(day, -1)) })).items.some((e) => e.id === rename.id));
  await a.get('/api/v1/admin/audit').query({ from: 'yesterday' }).expect(422);

  const p1 = await get({ limit: 2 });
  assert.equal(p1.items.length, 2);
  const p2 = await get({ limit: 2, cursor: p1.nextCursor! });
  assert.deepEqual([...p1.items, ...p2.items].map((e) => e.id), all.items.slice(0, 4).map((e) => e.id));
});

test('overview numbers match the database', async () => {
  const { body } = await (await agent('admin')).get('/api/v1/admin/overview').expect(200);
  const now = Date.now();

  const branches = await db.branch.findMany({ orderBy: { code: 'asc' } });
  const perBranch = await Promise.all(branches.map(async (b) => ({ branch: { id: b.id, code: b.code, name: b.name }, students: await db.user.count({ where: { role: 'student', homeClass: { branchId: b.id } } }) })));
  assert.deepEqual(body.studentsPerBranch, perBranch);
  assert.ok(perBranch.some((b) => b.students > 0));

  const week = { gte: new Date(now - 7 * 86_400_000) };
  for (const kind of ['ask', 'gig', 'market', 'lost', 'found'] as const)
    assert.equal(body.boardPostsThisWeek[kind], await db.boardPost.count({ where: { kind, createdAt: week } }), kind);
  assert.equal(body.openTickets, await db.ticket.count({ where: { state: 'open' } }));
  assert.equal(body.openReports, await db.report.count({ where: { state: 'open' } }));
  assert.equal(body.pendingInvites, await db.invite.count({ where: { acceptedAt: null, expiresAt: { gt: new Date() } } }));
  assert.ok(body.openTickets > 0 && body.pendingInvites > 0);

  const live = await db.class.findMany({ where: { archivedAt: null }, include: { terms: { where: { endedAt: null }, include: { _count: { select: { slots: true } } } } } });
  const bare = live.filter((c) => c.terms[0] && c.terms[0]._count.slots === 0).map((c) => c.id).sort();
  assert.deepEqual(body.classesWithoutTimetable.map((c: { id: string }) => c.id).sort(), bare);
  assert.ok(bare.length > 0 && !bare.includes('c1'), 'thin classes have no timetable; c1 has one');
});
