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
  const url = path(await presignPut(key, 'image/png'));
  const put = (u: string) => request(app).put(u).set('content-type', 'image/png').send(Buffer.from('x'));

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
