import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { audit } from '../src/lib/audit.js';
import { addDays, dow, today } from '../src/lib/dates.js';
import { db } from '../src/lib/db.js';
import { notify } from '../src/lib/notify.js';

test('today() is the institution date, not UTC: rolls over at 18:30 UTC for IST', () => {
  const at = (iso: string) => today('Asia/Kolkata', new Date(iso)).toISOString().slice(0, 10);
  assert.equal(at('2026-10-03T18:29:00Z'), '2026-10-03');
  assert.equal(at('2026-10-03T20:00:00Z'), '2026-10-04'); // UTC still says the 3rd
  assert.equal(today('UTC', new Date('2026-10-03T20:00:00Z')).toISOString().slice(0, 10), '2026-10-03');
});

test('dow / addDays', () => {
  const sat = new Date('2026-10-03');
  assert.equal(dow(sat), 6);
  assert.equal(dow(addDays(sat, 1)), 7);
  assert.equal(dow(addDays(sat, 2)), 1);
  assert.equal(addDays(sat, -3).toISOString(), '2026-09-30T00:00:00.000Z');
});

let institutionId = '';
let users: string[] = [];

before(async () => {
  const inst = await db.institution.create({ data: { name: 'FND-06 test' } });
  institutionId = inst.id;
  users = await Promise.all(
    ['a', 'b'].map(async (n) => {
      const u = await db.user.create({ data: { institutionId, role: 'student', name: n, email: `fnd06-${n}-${inst.id}@test.local` } });
      return u.id;
    }),
  );
});

after(async () => {
  await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
  await db.user.deleteMany({ where: { institutionId } }); // notifications cascade
  await db.institution.delete({ where: { id: institutionId } });
  await db.$disconnect();
});

test('audit writes one row and joins a transaction', async () => {
  const [actor] = users as [string];
  const row = await audit({ id: actor }, { action: 'test.edit', targetType: 'User', targetId: actor, before: { a: 1 }, after: { a: 2 } });
  assert.deepEqual([row.action, row.before, row.after], ['test.edit', { a: 1 }, { a: 2 }]);

  await assert.rejects(
    db.$transaction(async (tx) => {
      await audit({ id: actor }, { action: 'test.rolledback', targetType: 'User', targetId: actor }, tx);
      throw new Error('boom');
    }),
  );
  assert.equal(await db.auditLog.count({ where: { action: 'test.rolledback' } }), 0);
});

test('notify bulk-inserts one row per distinct user', async () => {
  const [a, b] = users as [string, string];
  assert.deepEqual(await notify([a, b, a], 'test-type', { x: 1 }), { count: 2 });
  assert.deepEqual(await notify([], 'test-type', {}), { count: 0 });
  const rows = await db.notification.findMany({ where: { userId: { in: users }, type: 'test-type' } });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0]?.payload, { x: 1 });
});
