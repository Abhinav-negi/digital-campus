import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultAdmissionYear, localPreview, yearLabel } from './NewClass.tsx';

test('admission year → year/semester label (July start)', () => {
  assert.equal(yearLabel(2026, new Date(2026, 9, 6)), '1st year · Semester 1');
  assert.equal(yearLabel(2025, new Date(2026, 9, 6)), '2nd year · Semester 3');
  assert.equal(yearLabel(2025, new Date(2026, 1, 6)), '1st year · Semester 2');
  assert.equal(yearLabel(2000, new Date(2026, 9, 6)), '4th year · Semester 8');
  assert.equal(defaultAdmissionYear(new Date(2026, 1, 1)), 2025);
});

test('local preview flags bad emails and repeats', () => {
  const r = localPreview('id, email\n25A, a@x.io\n25A, b@x.io\n25C, nope');
  assert.deepEqual(r.map((x) => x.issue), [null, 'Duplicate', 'Bad email']);
});
