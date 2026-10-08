import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSkills } from './ProfileForm.tsx';

test('parseSkills trims, drops blanks, caps at 10', () => {
  assert.deepEqual(parseSkills(' React, ,Go,'), ['React', 'Go']);
  assert.equal(parseSkills('a,b,c,d,e,f,g,h,i,j,k,l').length, 10);
});
