import type { RouteObject } from 'react-router';

// AF-01: /a/* children. Each AF task replaces its own line's `lazy` (one line per task, nothing else).
const soon = () => import('../Soon');
export const adminRoutes: RouteObject[] = [
  { index: true, lazy: () => import('./Inbox') }, // AF-01 Inbox
  { path: 'people/*', lazy: soon }, // AF-02
  { path: 'classes/*', lazy: soon }, // AF-03
  { path: 'commons/*', lazy: soon }, // AF-04a
  { path: 'school/*', lazy: () => import('./School') }, // AF-05
  { path: 'audit', lazy: () => import('./Audit') }, // AF-05
  { path: '*', lazy: soon },
];
