import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { addDays, today } from '../src/lib/dates.js';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

before(resetDb);
after(() => db.$disconnect());

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
/** No email address and no `email` key anywhere in a /commons response (SPEC §12). */
const noEmail = (body: unknown) => {
  const json = JSON.stringify(body);
  assert.doesNotMatch(json, EMAIL);
  assert.doesNotMatch(json, /"email"/);
};

type Card = { id: string; availability: 'open' | 'questions' | 'focus'; branch: { code: string } | null };
const ORDER = { open: 0, questions: 1, focus: 2 };

test('people: Open first, branches round-robined, me and banned excluded, cursor walks the whole list; no email', async () => {
  const riya = await agent('student');
  await db.user.update({ where: { id: 's2' }, data: { bannedAt: new Date() } });

  const all: Card[] = [];
  let cursor: string | null = null;
  do {
    const res = await riya.get('/api/v1/commons/people').query({ limit: 25, ...(cursor && { cursor }) }).expect(200);
    noEmail(res.body);
    all.push(...res.body.items);
    cursor = res.body.nextCursor;
  } while (cursor);

  const ids = all.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'no duplicates across pages');
  assert.ok(!ids.includes('s1'), 'not me');
  assert.ok(!ids.includes('s2'), 'not banned');
  const expected = await db.user.count({ where: { role: 'student', status: 'active', bannedAt: null, id: { not: 's1' }, profile: { isNot: null } } });
  assert.equal(all.length, expected);
  for (let i = 1; i < all.length; i++) assert.ok(ORDER[all[i - 1]!.availability] <= ORDER[all[i]!.availability], 'grouped by availability');

  // Round-robin: the first k open people come from k different branches (k = branches with open people).
  const open = all.filter((c) => c.availability === 'open');
  const branches = new Set(open.map((c) => c.branch?.code));
  assert.ok(branches.size >= 3);
  assert.equal(new Set(open.slice(0, branches.size).map((c) => c.branch?.code)).size, branches.size);
});

test('people: filters by branch, year, availability, helpsJuniors and q', async () => {
  const riya = await agent('student');
  const ece = (await riya.get('/api/v1/commons/people?branchId=ece&year=1&limit=100').expect(200)).body.items;
  assert.ok(ece.length > 0 && ece.every((c: { label: string; otherBranch: boolean }) => c.label === 'ECE · 1st year' && c.otherBranch));
  const focus = (await riya.get('/api/v1/commons/people?availability=focus&limit=100').expect(200)).body.items;
  assert.ok(focus.length > 0 && focus.every((c: Card & { focusUntil: string }) => c.availability === 'focus' && /^\d{4}-\d{2}-\d{2}$/.test(c.focusUntil)));
  const helpers = (await riya.get('/api/v1/commons/people?helpsJuniors=true&limit=100').expect(200)).body.items;
  assert.ok(helpers.length > 0 && helpers.every((c: { helpsJuniors: boolean }) => c.helpsJuniors));
  const iot = (await riya.get('/api/v1/commons/people?q=iot&limit=100').expect(200)).body.items;
  assert.ok(iot.length > 0 && iot.every((c: { skills: string[]; headline: string; name: string }) => /iot/i.test([c.name, c.headline, ...c.skills].join(' '))));
  await riya.get('/api/v1/commons/people?availability=busy').expect(422);
});

test('profile: focus past its date reads as open; track record, projects, canAsk; no email', async () => {
  const riya = await agent('student');
  const target = (await db.profile.findFirstOrThrow({ where: { availability: 'focus', userId: { not: 's1' }, user: { status: 'active', bannedAt: null } } })).userId;

  const focused = (await riya.get(`/api/v1/commons/profiles/${target}`).expect(200)).body;
  noEmail(focused);
  assert.equal(focused.availability, 'focus');
  assert.equal(focused.canAsk, false);

  await db.profile.update({ where: { userId: target }, data: { focusUntil: addDays(today(), -1) } });
  const lapsed = (await riya.get(`/api/v1/commons/profiles/${target}`).expect(200)).body;
  assert.equal(lapsed.availability, 'open');
  assert.equal(lapsed.focusUntil, null);
  assert.equal(lapsed.canAsk, true);
  const openIds = (await riya.get('/api/v1/commons/people?availability=open&limit=100').expect(200)).body.items.map((c: Card) => c.id);
  assert.ok(openIds.includes(target), 'lapsed focus is listed as open');

  // s12 sent Riya a request (seed cv1): no Ask, the state is shown.
  const kabir = (await riya.get('/api/v1/commons/profiles/s12').expect(200)).body;
  assert.deepEqual([kabir.canAsk, kabir.conversation?.state, kabir.conversation?.fromMe], [false, 'requested', false]);

  const me = (await riya.get('/api/v1/commons/profiles/s1').expect(200)).body;
  noEmail(me);
  assert.deepEqual([me.self, me.canAsk, me.label], [true, false, 'CSE · 2nd year']);
  assert.equal(me.track.helped, await db.thanks.count({ where: { toId: 's1' } }));
  assert.ok(me.projects.length > 0);
  assert.deepEqual(Object.keys(me.links).sort(), ['github', 'leetcode', 'linkedin', 'other']);

  await riya.get('/api/v1/commons/profiles/t1').expect(404); // staff have no Commons profile
});

test('the wall: a teacher gets 403 on /commons and on PATCH /me/profile', async () => {
  const meera = await agent('teacher');
  await meera.get('/api/v1/commons/people').expect(403);
  await meera.get('/api/v1/commons/profiles/s1').expect(403);
  await meera.patch('/api/v1/me/profile').send({ headline: 'hi' }).expect(403);
});

test('PATCH /me/profile: validates, focus defaults to +7 days, partial updates keep the rest', async () => {
  const riya = await agent('student');
  await riya.patch('/api/v1/me/profile').send({ headline: 'x'.repeat(101) }).expect(422);
  await riya.patch('/api/v1/me/profile').send({ skills: Array.from({ length: 11 }, (_, i) => `s${i}`) }).expect(422);
  await riya.patch('/api/v1/me/profile').send({ availability: 'open', focusUntil: '2030-01-01' }).expect(422);
  await riya.patch('/api/v1/me/profile').send({ availability: 'focus', focusUntil: '2000-01-01' }).expect(422);

  const focus = (await riya.patch('/api/v1/me/profile').send({ availability: 'focus' }).expect(200)).body;
  noEmail(focus);
  assert.equal(focus.availability, 'focus');
  assert.equal(focus.focusUntil, addDays(today(), 7).toISOString().slice(0, 10));

  const res = await riya
    .patch('/api/v1/me/profile')
    .send({ headline: 'Backend now', skills: ['Go', 'Go', 'SQL'], links: { github: 'riya' }, availability: 'questions', helpsJuniors: false })
    .expect(200);
  assert.deepEqual(
    [res.body.headline, res.body.skills, res.body.links, res.body.availability, res.body.focusUntil, res.body.helpsJuniors],
    ['Backend now', ['Go', 'SQL'], { github: 'riya', leetcode: '', linkedin: '', other: [] }, 'questions', null, false],
  );
  const kept = (await riya.patch('/api/v1/me/profile').send({ helpsJuniors: true }).expect(200)).body;
  assert.deepEqual([kept.headline, kept.availability, kept.helpsJuniors], ['Backend now', 'questions', true]);
});

test('GET /me/export: a JSON download of my data, never other users\' emails; works for staff too', async () => {
  const riya = await agent('student');
  const res = await riya.get('/api/v1/me/export').expect(200);
  assert.match(res.headers['content-disposition'] ?? '', /^attachment; filename="digital-campus-export-s1\.json"/);
  for (const key of ['user', 'profile', 'classes', 'attendance', 'projects', 'boardPosts', 'classPosts', 'conversations', 'tickets', 'notifications'])
    assert.ok(key in res.body, key);
  assert.ok(res.body.attendance.length > 0 && res.body.classes.length > 0 && res.body.conversations.length > 0);
  assert.equal(res.body.user.passwordHash, undefined);
  const emails = new Set(JSON.stringify(res.body).match(EMAIL));
  assert.deepEqual([...emails], [riya.user.email]);

  const meera = await agent('teacher');
  const t = await meera.get('/api/v1/me/export').expect(200);
  assert.match(t.headers['content-disposition'] ?? '', /attachment/);
  assert.deepEqual([...new Set(JSON.stringify(t.body).match(EMAIL))], [meera.user.email]);
});

test('profile links: handles only, and other links must be http(s) (no javascript: / data:)', async () => {
  const s = await agent('student');
  for (const links of [{ other: ['javascript:alert(1)'] }, { other: ['data:text/html,x'] }, { github: 'evil.com/x?y' }, { linkedin: 'a b' }])
    await s.patch('/api/v1/me/profile').send({ links }).expect(422);
  const ok = await s.patch('/api/v1/me/profile').send({ links: { github: 'riya.p-1', other: ['https://riya.dev'] } }).expect(200);
  assert.deepEqual(ok.body.links.other, ['https://riya.dev']);
});
