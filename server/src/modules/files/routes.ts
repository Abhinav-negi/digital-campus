import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import express, { Router } from 'express';
import { z } from 'zod';
import { auth } from '../../lib/auth.js';
import { HttpError } from '../../lib/http.js';
import { registry, route } from '../../lib/openapi.js';
import { claimSig, localPath, presignPut, releaseSig, sniffOk, UPLOAD_DIR, verifyLocal } from '../../lib/storage.js';

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
    const { name, contentType, size } = req.body as { name: string; contentType: keyof typeof EXT; size: number };
    const base = name.replace(/\.[^.]*$/, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'file';
    const key = `uploads/${userId}/${randomUUID()}-${base}.${EXT[contentType]}`;
    res.json({ uploadUrl: await presignPut(key, contentType, size), key });
  },
);

// Local driver (D14): the signed URLs from lib/storage.ts land here. The signature is the auth.
const keyOf = (req: express.Request) => (req.params.key as unknown as string[]).join('/');
const signed =
  (method: 'GET' | 'PUT'): express.RequestHandler =>
  (req, _res, next) => {
    // PUT links carry the presigned size inside the signature.
    const m = method === 'PUT' ? `PUT:${/^\d+$/.test(String(req.query.size)) ? req.query.size : 'x'}` : method;
    if (!verifyLocal(m, keyOf(req), req.query.exp, req.query.sig)) throw new HttpError(403, 'FORBIDDEN', 'Bad or expired link');
    next();
  };

router.put('/local/*key', signed('PUT'), async (req, res) => {
  const key = keyOf(req);
  const sig = req.query.sig as string;
  const max = Number(req.query.size);
  if (Number(req.headers['content-length']) > max) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'File is larger than declared');
  if (!claimSig(sig)) throw new HttpError(409, 'CONFLICT', 'This upload link was already used');
  try {
    // Count bytes as they stream; stop reading as soon as the declared size is passed.
    const chunks: Buffer[] = [];
    let n = 0;
    for await (const c of req as AsyncIterable<Buffer>) {
      n += c.length;
      if (n > max) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'File is larger than declared');
      chunks.push(c);
    }
    const body = Buffer.concat(chunks);
    if (body.length === 0) throw new HttpError(400, 'BAD_REQUEST', 'Send the file as the raw body');
    if (!sniffOk(key, body)) throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'File contents do not match the declared type');
    const path = localPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    res.status(200).end();
  } catch (e) {
    releaseSig(sig);
    throw e;
  }
});

router.get('/local/*key', signed('GET'), (req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.sendFile(keyOf(req), { root: UPLOAD_DIR }, (err) => {
    if (err) next((err as { status?: number }).status === 404 ? new HttpError(404, 'NOT_FOUND', 'No such file') : err);
  });
});

export default router;
