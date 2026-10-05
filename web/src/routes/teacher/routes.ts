import type { RouteObject } from 'react-router';

// FS-09: /t/* children. Each TE task replaces its own line's `lazy` (one line per task, nothing else).
const soon = () => import('../Soon');
export const teacherRoutes: RouteObject[] = [
  { index: true, lazy: () => import('./Today') }, // TE-01a Today
  { path: 'classes', lazy: () => import('./classes/ClassesList') }, // TE-04 ClassesList
  { path: 'classes/new', lazy: soon }, // TE-07 new class wizard
  { path: 'classes/:id/*', lazy: soon }, // TE-05a class view
  { path: 'upcoming', lazy: soon }, // TE-08 Upcoming
  { path: '*', lazy: soon },
];
