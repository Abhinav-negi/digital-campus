import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toBody } from './Compose.tsx';

test('toBody: gig maps negotiable + tags; market keeps price 0', () => {
  const g = toBody('gig', { title: ' T ', body: 'b', tags: 'a, b,', price: 50, negotiable: true, deadline: '2026-10-12' });
  assert.deepEqual(g, { kind: 'gig', title: 'T', body: 'b', tags: ['a', 'b'], price: 50, priceType: 'negotiable', deadline: '2026-10-12' });
  assert.equal((toBody('market', { title: 'x', marketType: 'give', price: 0, condition: 'Good', place: 'Canteen' }) as { price: number }).price, 0);
});
