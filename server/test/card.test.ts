import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

before(resetDb);
after(() => db.$disconnect());

const url = '/api/v1/commons/card';
const types = async (who: string) => ((await (await agent(who)).get(url).expect(200)).body.items as { type: string }[]).map((c) => c.type);

test('Riya gets the answer, join-request and project cards (every skill-matching ask/gig is already answered)', async () => {
  const items = (await (await agent('student')).get(url).expect(200)).body.items;
  assert.deepEqual(items.map((c: { type: string }) => c.type), ['answer', 'join-requests', 'project']);
  assert.equal(items[2].title, 'DSA Study Circle');
  assert.equal(items[0].refId, 'bp14');
  assert.equal(items[0].byline.id, (await db.answer.findUniqueOrThrow({ where: { id: 'an5' } })).authorId);
  assert.match(items[0].byline.label, /\S/); // "ME · 2nd year" pill on Today
  assert.equal(items[1].refId, 'pr1');
  assert.match(items[1].title, /^2 people want to join Campus Events/);
});

test('an unanswered ask matching my skills is the third card', async () => {
  await db.boardPost.create({ data: { id: 'bpx', authorId: 's2', kind: 'ask', title: 'React key warning?', tags: ['react'], expiresAt: new Date(Date.now() + 864e5 * 5) } });
  assert.deepEqual(await types('student'), ['answer', 'join-requests', 'ask', 'project']);
  await db.boardPost.update({ where: { id: 'bpx' }, data: { hiddenAt: new Date() } });
  assert.ok(!(await types('student')).includes('ask'));
});

test('blocked people and hidden items drop out; teachers are walled off', async () => {
  const answerer = (await db.answer.findUniqueOrThrow({ where: { id: 'an5' } })).authorId;
  await db.block.create({ data: { userId: 's1', blockedId: answerer } });
  assert.ok(!(await types('student')).includes('answer'));
  await db.joinRequest.updateMany({ where: { projectId: 'pr1' }, data: { state: 'declined' } });
  assert.ok(!(await types('student')).includes('join-requests'));
  await agent('teacher').then((t) => t.get(url).expect(403));
});
