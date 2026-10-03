import { QueryClient } from '@tanstack/react-query';
import { createBrowserRouter, redirect, type RouteObject } from 'react-router';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
});

export type Me = { id: string; name: string; role: 'student' | 'staff'; isAdmin: boolean; isChief: boolean; classes?: unknown[] };

// ponytail: untyped fetch until FS-05 generates schema.d.ts; swap for the typed client/useMe then.
// Any failure (401, API down, offline) means "no session".
export const meQuery = {
  queryKey: ['me'],
  queryFn: async (): Promise<Me | null> => {
    try {
      const r = await fetch('/api/v1/auth/me', { credentials: 'include' });
      if (!r.ok) return null;
      const d = await r.json();
      return d.user ?? d;
    } catch {
      return null;
    }
  },
};

type Area = 's' | 't' | 'a';
export const homeOf = (u: Me) => (u.role === 'student' ? '/s' : u.isChief && !u.classes?.length ? '/a' : '/t');
const allowed: Record<Area, (u: Me) => boolean> = {
  s: (u) => u.role === 'student',
  t: (u) => u.role === 'staff',
  a: (u) => u.isAdmin,
};

const guard = (area: Area) => async () => {
  const u = await queryClient.fetchQuery(meQuery);
  if (!u) throw redirect('/login');
  if (!allowed[area](u)) throw redirect(homeOf(u));
  return u;
};

// Placeholder pages; area tasks replace each `lazy` with `() => import('./routes/<area>')`.
const page = (title: string) => async () => ({
  Component: () => (
    <main className="main">
      <h1>{title}</h1>
    </main>
  ),
});

const routes: RouteObject[] = [
  { path: '/', lazy: page('Digital Campus') },
  { path: '/login', lazy: page('Log in') },
  { path: '/invite/:token', lazy: page('Invite') },
  { path: '/s/*', loader: guard('s'), lazy: page('Student') },
  { path: '/t/*', loader: guard('t'), lazy: page('Teacher') },
  { path: '/a/*', loader: guard('a'), lazy: page('Admin') },
  { path: '*', loader: () => redirect('/') },
];
// Component test page (FS-02/FS-03), dev only.
if (import.meta.env.DEV) routes.unshift({ path: '/ui', lazy: () => import('./ui/Kitchen') });

export const router = createBrowserRouter(routes);
