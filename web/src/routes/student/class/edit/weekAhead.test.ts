import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateRun } from './WeekAhead.tsx';

test('dateRun: 14 consecutive days across a month end', () => {
  const r = dateRun('2026-01-25');
  assert.equal(r.length, 14);
  assert.equal(r[7], '2026-02-01');
  assert.equal(r[13], '2026-02-07');
});
