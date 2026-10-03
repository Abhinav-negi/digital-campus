import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmt, rel, greeting, today } from './dates.ts';

test('dates', () => {
  assert.equal(fmt('2026-10-12'), 'Mon 12 Oct');
  assert.equal(rel('2026-10-12', '2026-10-12'), 'today');
  assert.equal(rel('2026-10-13', '2026-10-12'), 'tomorrow');
  assert.equal(rel('2026-10-11', '2026-10-12'), 'yesterday');
  assert.equal(rel('2026-11-01', '2026-10-25'), 'in 7 days'); // crosses a DST change in many zones
  assert.equal(rel('2026-10-09', '2026-10-12'), '3 days ago');
  assert.equal(today(new Date(2026, 0, 5, 23, 30)), '2026-01-05');
  assert.deepEqual([9, 12, 16, 17, 22].map(greeting), ['Good morning', 'Good afternoon', 'Good afternoon', 'Good evening', 'Good evening']);
});
