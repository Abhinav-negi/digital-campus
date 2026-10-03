import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { Component as Landing } from './index.tsx';

test('landing: role cards link to /login', () => {
  const html = renderToString(<MemoryRouter><Landing /></MemoryRouter>);
  for (const label of ['Open student app', 'Open teacher app']) assert.match(html, new RegExp(`href="/login"[^>]*>${label}<`));
});
