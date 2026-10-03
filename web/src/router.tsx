import { QueryClient } from '@tanstack/react-query';
import { createBrowserRouter, redirect, type RouteObject } from 'react-router';
import { meQuery, type Me } from './api/hooks';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
});

type Area = 's' | 't' | 'a';
export const homeOf = ({ user, classes }: Me) => (user.role === 'student' ? '/s' : user.isChief && !classes.length ? '/a' : '/t');
const allowed: Record<Area, (m: Me) => boolean> = {
  s: (m) => m.user.role === 'student',
  t: (m) => m.user.role === 'staff',
  a: (m) => m.user.isAdmin,
};

const guard = (area: Area) => async () => {
  const me = await queryClient.fetchQuery(meQuery);
  if (!me) throw redirect('/login');
  if (!allowed[area](me)) throw redirect(homeOf(me));
  return me;
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
  { path: '/', lazy: () => import('./routes/landing') },
  { path: '/login', lazy: page('Log in') },
  { path: '/invite/:token', lazy: page('Invite') },
  { path: '/s/*', loader: guard('s'), lazy: page('Student') },
  { path: '/t/*', loader: guard('t'), lazy: page('Teacher') },
  { path: '/a/*', loader: guard('a'), lazy: page('Admin') },
  { path: '*', loader: () => redirect('/') },
];
// Component test page (FS-02/FS-03), dev only.
if (import.meta.env.DEV)
  routes.unshift(
    { path: '/ui', lazy: () => import('./ui/Kitchen') },
    { path: '/ui/shell/:p/*', lazy: () => import('./ui/ShellDemo') },
  );

export const router = createBrowserRouter(routes);
