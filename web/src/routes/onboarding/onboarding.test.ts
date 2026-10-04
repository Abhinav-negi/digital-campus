import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// index.tsx pulls in router.tsx (homeOf), which creates the browser router on import: DOM first.
const { window } = new JSDOM('', { url: 'http://localhost/' });
Object.assign(globalThis, { window, document: window.document });

test('onboarding: pasted profile URLs become handles', async () => {
  const { handleOf } = await import('./index.tsx');
  const cases = {
    'https://github.com/riya': 'riya',
    'github.com/riya/?tab=repos': 'riya',
    'https://www.linkedin.com/in/riya-patel-123/': 'riya-patel-123',
    'https://leetcode.com/u/riya_p/': 'riya_p',
    '@riya': 'riya',
    ' riya.patel ': 'riya.patel',
    '': '',
  };
  for (const [v, want] of Object.entries(cases)) assert.equal(handleOf(v), want, v);
});
