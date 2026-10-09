import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mock, test } from 'node:test';
import express from 'express';
import request from 'supertest';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { errorHandler } from '../src/lib/http.js';
import { deleteObject, localPath, presignGet, presignPut } from '../src/lib/storage.js';
import files from '../src/modules/files/routes.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const path = (url: string) => url.slice(config.APP_URL.length);

// Stand-in for FND-04's authenticate middleware.
const authed = express()
  .use(express.json())
  .use((req, _res, next) => {
    (req as { user?: { id: string } }).user = { id: 'u_test' };
    next();
  })
  .use('/api/v1/files', files)
  .use(errorHandler);

test('presign → PUT lands on disk → presignGet downloads → deleteObject removes', async () => {
  const res = await request(authed)
    .post('/api/v1/files/presign')
    .send({ name: '../My Notes (v2).html.pdf', contentType: 'application/pdf', size: 5 })
    .expect(200);
  const { uploadUrl, key } = res.body;
  assert.match(key, /^uploads\/u_test\/[0-9a-f-]{36}-My_Notes_v2_html\.pdf$/);
  assert.ok(uploadUrl.startsWith(`${config.APP_URL}/api/v1/files/local/${key}?exp=`));

  await request(app).put(path(uploadUrl)).set('content-type', 'application/pdf').send(Buffer.from('%PDF-')).expect(200);
  assert.ok(existsSync(localPath(key)));

  const got = await request(app).get(path(await presignGet(key))).buffer(true).expect(200).expect('content-type', /pdf/);
  assert.equal(got.body.toString(), '%PDF-');

  // A PUT signature doesn't work for GET.
  await request(app).get(path(uploadUrl)).expect(403);

  await deleteObject(key);
  assert.ok(!existsSync(localPath(key)));
});

test('presign rejects bad types and sizes; needs a user', async () => {
  const body = { name: 'a.exe', contentType: 'application/x-msdownload', size: 5 };
  await request(authed).post('/api/v1/files/presign').send(body).expect(422);
  await request(authed).post('/api/v1/files/presign').send({ ...body, contentType: 'image/png', size: 16 * 1024 * 1024 }).expect(422);
  await request(app).post('/api/v1/files/presign').send({ ...body, contentType: 'image/png' }).expect(401);
});

test('tampered or expired signature → 403', async () => {
  const key = 'uploads/u_test/sig-test.png';
  const url = path(await presignPut(key, 'image/png', 1));
  const put = (u: string) => request(app).put(u).set('content-type', 'image/png').send(PNG);

  await put(url.replace(/sig=./, (m) => (m.endsWith('A') ? 'sig=B' : 'sig=A'))).expect(403);
  await put(url.replace(/exp=(\d+)/, (_m, e) => `exp=${Number(e) + 60}`)).expect(403);
  await put(url.replace('sig-test', 'other')).expect(403);
  await put(url.replace(/&sig=.*/, '')).expect(403);

  mock.timers.enable({ apis: ['Date'], now: Date.now() + 16 * 60 * 1000 });
  try {
    await put(url).expect(403);
  } finally {
    mock.timers.reset();
  }
  assert.ok(!existsSync(localPath(key)));
});

test('localPath refuses keys outside the upload dir', () => {
  assert.throws(() => localPath('../../etc/passwd'));
});

test('local PUT enforces size, magic bytes and single use', async () => {
  const presign = async (name: string, contentType: string, size: number) =>
    path((await request(authed).post('/api/v1/files/presign').send({ name, contentType, size }).expect(200)).body.uploadUrl);
  const put = (u: string, body: Buffer) => request(app).put(u).set('content-type', 'application/octet-stream').send(body);

  // R4 repro: presigned a pdf of 10 bytes, send 1 KB of HTML -> rejected; link stays usable for a real pdf.
  const url = await presign('a.pdf', 'application/pdf', 10);
  const r = await put(url, Buffer.from('<html>'.padEnd(1024, 'x')));
  assert.ok(r.status >= 400 && r.status < 500);
  // Right size, wrong type.
  assert.equal((await put(url, Buffer.from('<html>abcd'))).status, 415);
  await put(url, Buffer.from('%PDF-1.4 x')).expect(200);
  // Same URL again -> 4xx.
  assert.ok((await put(url, Buffer.from('%PDF-1.4 x'))).status >= 400);

  // Editing size in the URL breaks the signature.
  const big = await presign('b.png', 'image/png', 8);
  await put(big.replace('size=8', 'size=9999'), PNG).expect(403);
  // Chunked/unknown length over the limit is cut off too.
  assert.equal((await put(big, Buffer.concat([PNG, Buffer.from('more')]))).status, 413);
  await put(big, PNG).expect(200);
});
