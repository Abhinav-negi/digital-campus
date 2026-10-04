import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { app } from '../src/app.js';
import { errorHandler, page, paginate, validate } from '../src/lib/http.js';

test('GET /api/v1/health → { ok: true }', async () => {
  const res = await request(app).get('/api/v1/health').expect(200);
  assert.deepEqual(res.body, { ok: true });
});

test('GET /api/v1/openapi.json → the generated contract', async () => {
  const res = await request(app).get('/api/v1/openapi.json').expect(200);
  assert.ok(res.body.paths['/health']);
});

test('unknown route → 404 JSON', async () => {
  for (const path of ['/api/v1/nope', '/nope']) {
    const res = await request(app).get(path).expect(404).expect('content-type', /json/);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  }
});

test('bad JSON body → 400 JSON', async () => {
  const res = await request(app).post('/api/v1/auth/login').set('content-type', 'application/json').send('{').expect(400);
  assert.equal(res.body.error.code, 'BAD_REQUEST');
});

test('unique-index race (Prisma P2002) → 409 CONFLICT, not 500', async () => {
  const mini = express()
    .get('/dup', () => {
      throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    })
    .use(errorHandler);
  assert.equal((await request(mini).get('/dup').expect(409)).body.error.code, 'CONFLICT');
});

test('validate: zod failure → 422 VALIDATION, success → parsed values', async () => {
  const mini = express()
    .use(express.json())
    .get('/q', validate({ query: z.object({ n: z.coerce.number() }) }), (req, res) => {
      res.json(req.query);
    })
    .post('/b', validate({ body: z.object({ name: z.string() }) }), (req, res) => {
      res.json(req.body);
    })
    .use(errorHandler);

  const bad = await request(mini).post('/b').send({ name: 1 }).expect(422).expect('content-type', /json/);
  assert.equal(bad.body.error.code, 'VALIDATION');
  assert.match(bad.body.error.message, /name/);
  await request(mini).get('/q?n=x').expect(422);
  assert.deepEqual((await request(mini).get('/q?n=5').expect(200)).body, { n: 5 });
});

test('every ARCH §8 module path is mounted (501)', async () => {
  const paths = [
    '/posts',
    '/classes/c1/posts',
    '/attendance-sessions',
    '/checkin',
    '/me/attendance',
  ];
  for (const path of paths) {
    const res = await request(app).get(`/api/v1${path}`);
    assert.equal(res.status, 501, path);
    assert.equal(res.body.error.code, 'NOT_IMPLEMENTED', path);
  }
});

test('guarded paths without a session → 401', async () => {
  for (const [method, path] of [['get', '/auth/me'], ['post', '/files/presign'], ['get', '/commons/people'], ['get', '/classes'], ['get', '/classes/c1/members'], ['get', '/staff'], ['get', '/me/today'], ['get', '/admin/overview'], ['get', '/tickets/mine']] as const) {
    const res = await request(app)[method](`/api/v1${path}`);
    assert.equal(res.status, 401, path);
  }
});

test('paginate/page', () => {
  assert.deepEqual(paginate(undefined, 2), { take: 3 });
  assert.deepEqual(paginate('b', 2), { take: 3, cursor: { id: 'b' }, skip: 1 });
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(page(rows, 2), { items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'b' });
  assert.deepEqual(page(rows, 3), { items: rows, nextCursor: null });
});
