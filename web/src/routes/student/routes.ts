import type { RouteObject } from 'react-router';

// FS-09: /s/* children. Each ST task replaces its own line's `lazy` (one line per task, nothing else).
const soon = () => import('../Soon');
export const studentRoutes: RouteObject[] = [
  { index: true, lazy: () => import('./Today') }, // ST-01 Today
  { path: 'class/*', lazy: () => import('./class/ClassPage') }, // ST-02 ClassPage (owns its tabs below this)
  { path: 'commons/*', lazy: () => import('./commons/CommonsPage') }, // ST-07a CommonsPage
  { path: 'me/*', lazy: () => import('./me/MePage') }, // ST-10a Me
  { path: '*', lazy: soon },
];
