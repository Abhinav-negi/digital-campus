import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summaryLine } from './Import.tsx';

test('summary counts ready rows and each issue kind', () => {
  assert.equal(summaryLine([{}, {}, { issue: 'unmatched-teacher' }, { issue: 'unmatched-teacher' }, { issue: 'bad-time' }]), '2 ready · 2 need a teacher · 1 bad time');
  assert.equal(summaryLine([]), '0 ready');
});
