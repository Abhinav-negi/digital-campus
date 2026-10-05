import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trimSat, weekDates, type Day } from './Board.tsx';

test('weekDates: Mon..Sat of the week, Sunday belongs to the week before', () => {
  assert.deepEqual(weekDates(new Date(2026, 9, 5)), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']);
  assert.equal(weekDates(new Date(2026, 9, 11))[0], '2026-10-05');
});

test('trimSat: Saturday only when it has slots', () => {
  const d = (n: number): Day => ({ label: 'x', today: false, cells: Array(n).fill({ key: 'k', subject: 's', start: '', end: '', room: null }) });
  assert.equal(trimSat([d(1), d(1), d(1), d(1), d(1), d(0)]).length, 5);
  assert.equal(trimSat([d(1), d(1), d(1), d(1), d(1), d(1)]).length, 6);
});
