import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPassword } from './reset.tsx';

// ponytail: login/reset flows are checked end to end in the browser; rendering login here needs router.tsx,
// whose `import.meta.env.DEV` is undefined under tsx.
test('reset: PROTO validation copy', () => {
  assert.equal(checkPassword('short', 'short'), 'Use at least 8 characters.');
  assert.equal(checkPassword('campus123', 'campus124'), 'The two passwords do not match.');
  assert.equal(checkPassword('campus123', 'campus123'), '');
});
