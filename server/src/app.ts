import { join } from 'node:path';
import cookieParser from 'cookie-parser';
import express, { Router } from 'express';
import { config } from './config.js';
import { errorHandler, notFound } from './lib/http.js';
import { openApiDocument } from './lib/openapi.js';
import admin from './modules/admin/routes.js';
import attendance from './modules/attendance/routes.js';
import auth from './modules/auth/routes.js';
import classes from './modules/classes/routes.js';
import commons from './modules/commons/routes.js';
import files from './modules/files/routes.js';
import me from './modules/me/routes.js';
import posts from './modules/posts/routes.js';
import staff from './modules/staff/routes.js';
import tickets from './modules/tickets/routes.js';

declare global {
  namespace Express {
    interface Request {
      deviceId?: string;
    }
  }
}

// Router registry (ARCH §8). Orchestrator-owned: modules change their own routes.ts, not this list.
// Order matters: more specific prefixes (/classes/:id/posts, /me/attendance) before their parents.
const modules: [string | string[], Router][] = [
  ['/auth', auth],
  ['/files', files],
  ['/staff', staff],
  [['/posts', '/classes/:id/posts'], posts],
  [['/attendance-sessions', '/checkin', '/me/attendance'], attendance],
  ['/classes', classes],
  ['/me', me],
  ['/commons', commons],
  ['/tickets', tickets],
  ['/admin', admin],
];

const api = Router();
api.get('/health', (_req, res) => {
  res.json({ ok: true });
});
// Module imports above have run, so every route is registered by now.
const spec = openApiDocument();
api.get('/openapi.json', (_req, res) => {
  res.json(spec);
});
for (const [path, router] of modules) api.use(path, router);

export const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((req, _res, next) => {
  req.deviceId = req.get('x-device-id');
  next();
});
app.use('/api/v1', api);

if (config.NODE_ENV === 'production') {
  const webDist = join(import.meta.dirname, '../../web/dist');
  app.use(express.static(webDist));
  app.get(/^\/(?!api(\/|$))/, (_req, res) => res.sendFile(join(webDist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);
