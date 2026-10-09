import type { RouteObject } from 'react-router';

// FS-09: /t/* children. Each TE task replaces its own line's `lazy` (one line per task, nothing else).
const soon = () => import('../Soon');
export const teacherRoutes: RouteObject[] = [
  { index: true, lazy: () => import('./Today') }, // TE-01a Today
  { path: 'attend/:sessionId', lazy: () => import('./attendance/AttendancePage') }, // TE-02 attendance
  { path: 'classes', lazy: () => import('./classes/ClassesList') }, // TE-04 ClassesList
  { path: 'classes/new', lazy: () => import('./classes/NewClass') }, // TE-07 new class wizard
  { path: 'classes/:id/*', lazy: () => import('./class/ClassView') }, // TE-05a class view
  { path: 'upcoming', lazy: () => import('./Upcoming') }, // TE-08 Upcoming
  { path: '*', lazy: soon },
];
