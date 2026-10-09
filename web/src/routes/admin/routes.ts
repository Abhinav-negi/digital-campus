import type { RouteObject } from 'react-router';

// AF-01: /a/* children. Each AF task replaces its own line's `lazy` (one line per task, nothing else).
const soon = () => import('../Soon');
export const adminRoutes: RouteObject[] = [
  { index: true, lazy: () => import('./Inbox') }, // AF-01 Inbox
  { path: 'people', lazy: () => import('./people') }, // AF-02
  { path: 'classes', lazy: () => import('./classes/List') }, // AF-03
  { path: 'classes/new', lazy: () => import('./classes/New') }, // AF-03
  { path: 'classes/:id/correct', lazy: () => import('./classes/Correct') }, // AF-03 attendance correction
  { path: 'classes/:id/*', lazy: () => import('./classes/Detail') }, // AF-03 = TE-05 ClassView adminMode
  { path: 'commons/*', lazy: () => import('./commons/CommonsAdmin') }, // AF-04a
  { path: 'school/*', lazy: () => import('./School') }, // AF-05
  { path: 'audit', lazy: () => import('./Audit') }, // AF-05
  { path: '*', lazy: soon },
];
