import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import express, { Router } from 'express';
import { z } from 'zod';
import { auth } from '../../lib/auth.js';
import { HttpError } from '../../lib/http.js';
import { registry, route } from '../../lib/openapi.js';
import { localPath, presignPut, UPLOAD_DIR, verifyLocal } from '../../lib/storage.js';

const MAX_BYTES = 15 * 1024 * 1024;
/** Allowed upload types → the extension the key gets (so GET serves the right Content-Type). */
const EXT = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/zip': 'zip',
} as const;

const router = Router();

router.post(
  '/presign',
  auth(),
  route(registry, {
    method: 'post',
    path: '/files/presign',
    summary: 'Get a URL to PUT one file to',
    guard: 'auth',
    request: {
      body: z.object({
        name: z.string().min(1).max(200),
        contentType: z.enum(Object.keys(EXT) as [keyof typeof EXT]),
        size: z.number().int().positive().max(MAX_BYTES),
      }),
    },
    responses: { 200: z.object({ uploadUrl: z.string(), key: z.string() }) },
  }),
  async (req, res) => {
    const userId = req.user!.id;
    const { name, contentType } = req.body as { name: string; contentType: keyof typeof EXT };
    const base = name.replace(/\.[^.]*$/, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'file';
    const key = `uploads/${userId}/${randomUUID()}-${base}.${EXT[contentType]}`;
    res.json({ uploadUrl: await presignPut(key, contentType), key });
  },
);

// Local driver (D14): the signed URLs from lib/storage.ts land here. The signature is the auth.
const keyOf = (req: express.Request) => (req.params.key as unknown as string[]).join('/');
const signed =
  (method: 'GET' | 'PUT'): express.RequestHandler =>
  (req, _res, next) => {
    if (!verifyLocal(method, keyOf(req), req.query.exp, req.query.sig)) throw new HttpError(403, 'FORBIDDEN', 'Bad or expired link');
    next();
  };

router.put('/local/*key', signed('PUT'), express.raw({ type: () => true, limit: MAX_BYTES }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, 'BAD_REQUEST', 'Send the file as the raw body');
  const path = localPath(keyOf(req));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, req.body);
  res.status(200).end();
});

router.get('/local/*key', signed('GET'), (req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.sendFile(keyOf(req), { root: UPLOAD_DIR }, (err) => {
    if (err) next((err as { status?: number }).status === 404 ? new HttpError(404, 'NOT_FOUND', 'No such file') : err);
  });
});

export default router;
