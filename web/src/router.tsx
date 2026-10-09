import { QueryClient } from '@tanstack/react-query';
import { createBrowserRouter, redirect, type RouteObject } from 'react-router';
import { meQuery, type Me } from './api/hooks';
import { adminRoutes } from './routes/admin/routes';
import { studentRoutes } from './routes/student/routes';
import { teacherRoutes } from './routes/teacher/routes';

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
  if (!allowed[area](me)) throw redirect('/403');
  return me;
};

const routes: RouteObject[] = [
  { path: '/', lazy: () => import('./routes/landing') },
  // Already logged in → your home, not the form.
  { path: '/login', loader: async () => { const me = await queryClient.fetchQuery(meQuery); return me ? redirect(homeOf(me)) : null; }, lazy: () => import('./routes/auth/login') },
  { path: '/forgot', lazy: () => import('./routes/auth/forgot') },
  { path: '/reset/:token', lazy: () => import('./routes/auth/reset') },
  { path: '/invite/:token', lazy: () => import('./routes/onboarding') },
  { path: '/s', loader: guard('s'), lazy: () => import('./routes/student'), children: studentRoutes },
  { path: '/t', loader: guard('t'), lazy: () => import('./routes/teacher'), children: teacherRoutes },
  { path: '/a', loader: guard('a'), lazy: () => import('./routes/admin/AdminLayout'), children: adminRoutes },
  { path: '/403', lazy: () => import('./routes/Forbidden') },
  { path: '*', loader: () => redirect('/') },
];
// Component test page (FS-02/FS-03), dev only.
if (import.meta.env?.DEV)
  routes.unshift(
    { path: '/ui', lazy: () => import('./ui/Kitchen') },
    { path: '/ui/shell/:p/*', lazy: () => import('./ui/ShellDemo') },
  );

export const router = createBrowserRouter(routes);
