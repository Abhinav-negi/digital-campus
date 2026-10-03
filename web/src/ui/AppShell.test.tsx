import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { NavItem } from './AppShell.tsx';

// DOM globals must exist before react-dom loads, so the React modules are imported dynamically below.
const { window } = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
globalThis.fetch = async () => Response.json({ unreadCount: 3 });

test('app shell: body class, active nav follows the route, bell count, footer links', async () => {
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { MemoryRouter } = await import('react-router');
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const { AppShell } = await import('./AppShell.tsx');

  const nav: NavItem[] = [
    { to: '/t', label: 'Today', icon: 'home' },
    { to: '/t/classes', label: 'Classes', icon: 'class' },
    { to: '/t/upcoming', label: 'Upcoming', icon: 'calendar' },
  ];
  const qc = new QueryClient();
  const root = createRoot(document.body.appendChild(document.createElement('div')));
  const render = (p: 'teacher' | 'admin') => act(async () => root.render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/t/classes/c1']}><AppShell personality={p} nav={nav} isAdmin /></MemoryRouter>
    </QueryClientProvider>,
  ));
  const on = (sel: string) => [...document.querySelectorAll(`${sel} .nav-item.on`)].map((e) => e.textContent);
  const foot = () => [...document.querySelectorAll('.rail .foot a')].map((e) => e.textContent);

  await render('teacher');
  assert.equal(document.body.className, 'teacher');
  assert.deepEqual(on('.rail'), ['Classes']); // sub-route keeps its section active
  assert.deepEqual(on('.bottom-nav'), ['Classes']);
  assert.equal(document.querySelector('.bell b')?.textContent, '3');
  assert.deepEqual(foot(), ['Admin', 'Log out']);

  await act(async () => document.querySelector<HTMLElement>('.rail a[href="/t"]')!.click());
  assert.deepEqual(on('.rail'), ['Today']); // home matches exactly, so only Today

  await render('admin');
  assert.equal(document.body.className, 'teacher admin');
  assert.deepEqual(foot(), ['Teacher app', 'Log out']);

  await act(async () => root.unmount());
  assert.equal(document.body.className, '');
  qc.clear();
  window.close();
});
