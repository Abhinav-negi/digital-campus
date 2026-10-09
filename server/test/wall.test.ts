import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { openApiDocument } from '../src/lib/openapi.js';
import { ORIGIN, agent, resetDb } from './helpers.js';

// QA-01: the wall, end to end (ARCH §3). Every (method, path) in the OpenAPI document × every role.
//
// MATRIX is the contract: route -> the roles that may call it. Every other role must get 403 (default deny),
// an anonymous caller or a disabled account 401. A route in OpenAPI with no MATRIX entry FAILS the suite (and so does a
// stale entry), so a new route cannot ship without someone deciding who may call it.
//
// "Allowed" means only: not 401/403. The request is sent with a minimal/empty body, so a 404/409/422 from the handler
// is fine; the point is that the guard let the caller through. Where a handler itself enforces the role (attendance,
// schedule changes, check-in) the route has a valid body in INPUT so the deny comes from the wall, not from validation.
// Denies run before allows, so destructive allowed calls (graduate, next term) cannot disturb a deny check.

const API = '/api/v1';
const CLASS = 'c2'; // CSE 2B: class teacher t4, CR s31, sub7 taught by t2; t3 teaches nowhere in c2.
const SUBJECT = 'sub7';
const WHO = {
  student: 's32', // plain student of c2
  cr: 's31',
  outsiderStudent: 's2', // student of c1: no access to c2
  banned: 's33', // c2 student banned from the Commons (set in before)
  classTeacher: 't4',
  subjectTeacher: 't2', // teaches sub7 only
  outsider: 't3', // teacher, but not in c2
  admin: 'a1', // the chief
  disabled: 't0',
} as const;
type Who = keyof typeof WHO;
const ROLES = Object.keys(WHO) as Who[];

const STUDENTS: Who[] = ['student', 'cr', 'outsiderStudent', 'banned'];
const STAFF: Who[] = ['classTeacher', 'subjectTeacher', 'outsider', 'admin'];
const ALL: Who[] = [...STUDENTS, ...STAFF];
const COMMONS: Who[] = ['student', 'cr', 'outsiderStudent', 'admin']; // the wall: no teachers; a banned student gets 403 BANNED
const READ: Who[] = ['student', 'cr', 'banned', 'classTeacher', 'subjectTeacher', 'admin']; // members + teachers of the class
const BOARD: Who[] = ['cr', 'classTeacher', 'admin'];
const TEACH: Who[] = ['classTeacher', 'subjectTeacher', 'admin'];
const OWN: Who[] = ['classTeacher', 'admin'];
const PARTICIPATE: Who[] = ['student', 'cr', 'outsiderStudent']; // Commons actions that need a student identity (studentOnly in the handler); an admin moderates via /admin instead
const ADMIN: Who[] = ['admin'];
const PUBLIC = 'public';

const MATRIX: Record<string, Who[] | typeof PUBLIC> = {
  'GET /health': PUBLIC,
  'POST /auth/login': PUBLIC,
  'POST /auth/forgot': PUBLIC,
  'POST /auth/reset': PUBLIC,
  'GET /auth/invite/{token}': PUBLIC,
  'POST /auth/invite/{token}/accept': PUBLIC,
  'POST /auth/logout': ALL,
  'GET /auth/me': ALL,
  'POST /files/presign': ALL,
  
  'GET /staff': ALL,
  'GET /branches': ALL,
  'POST /tickets': ALL,
  'GET /tickets/mine': ALL,
  'GET /tickets/{id}': ALL,
  'POST /tickets/{id}/replies': ALL,

  // /me: any account, except the student-only and staff-only ones
  'GET /me/export': ALL,
  'GET /me/today': ALL,
  'GET /me/upcoming': ALL,
  'GET /me/notifications': ALL,
  'POST /me/notifications/read': ALL,
  'GET /me/notification-prefs': ALL,
  'PUT /me/notification-prefs': ALL,
  'PATCH /me/profile': STUDENTS,
  'DELETE /me': ALL, // everyone reaches the handler (422 without a password); the chief's refusal is asserted below
  'GET /me/reminders': STAFF,
  'POST /me/reminders': STAFF,
  'DELETE /me/reminders/{id}': STAFF,
  'GET /me/attendance': STUDENTS, // own attendance only; teachers and admins have none
  'POST /checkin': STUDENTS,

  // teacher posts
  'POST /posts': STAFF,
  'GET /posts/mine': STAFF,
  'POST /posts/{id}/seen': STUDENTS,
  'POST /posts/{id}/remind': ALL, // author-or-admin is checked after the lookup, so with an unknown id everyone reaches the 404
  'GET /classes/{id}/posts': READ,

  // classes
  'GET /classes': ALL,
  'POST /classes': STAFF,
  'GET /classes/{id}': READ,
  'PATCH /classes/{id}': OWN,
  'GET /classes/{id}/terms': READ,
  'POST /classes/{id}/terms/next': OWN,
  'POST /classes/{id}/graduate': OWN,
  'POST /classes/{id}/handover': OWN,
  'GET /classes/{id}/members': READ,
  'POST /classes/{id}/invites': OWN,
  'POST /classes/{id}/invites/resend': OWN,
  'PUT /classes/{id}/cr': OWN,
  'DELETE /classes/{id}/members/{userId}': OWN,
  'GET /classes/{id}/board': READ,
  'POST /classes/{id}/board': BOARD,
  'POST /classes/{id}/board/from-post': BOARD,
  'PATCH /classes/{id}/board/{itemId}': BOARD,
  'DELETE /classes/{id}/board/{itemId}': BOARD,
  'GET /classes/{id}/history': BOARD,
  'GET /classes/{id}/subjects': READ,
  'POST /classes/{id}/subjects': BOARD,
  'PATCH /classes/{id}/subjects/{sid}': BOARD,
  'DELETE /classes/{id}/subjects/{sid}': BOARD,
  'POST /classes/{id}/subjects/{sid}/decline': READ, // "Not me": the allotted teacher; with an unknown subject everyone with read gets the 404
  'GET /classes/{id}/timetable': READ,
  'POST /classes/{id}/timetable': BOARD,
  'PUT /classes/{id}/timetable': BOARD,
  'PATCH /classes/{id}/timetable/{slotId}': BOARD,
  'DELETE /classes/{id}/timetable/{slotId}': BOARD,
  'GET /classes/{id}/schedule': READ,
  'POST /classes/{id}/changes': ['cr', 'classTeacher', 'subjectTeacher', 'admin'], // subject teacher: their own subject only (sub7)
  'DELETE /classes/{id}/changes/{changeId}': ['cr', 'classTeacher', 'subjectTeacher', 'admin'],
  'GET /classes/{id}/imports/prompts': BOARD,
  'POST /classes/{id}/imports/preview': BOARD,
  'POST /classes/{id}/imports/apply': BOARD,

  // attendance: never the CR, never a student; a teacher only for their own subject (or as class teacher)
  'POST /attendance-sessions': TEACH,
  'GET /attendance-sessions/{id}': TEACH,
  'PUT /attendance-sessions/{id}': TEACH,
  'POST /attendance-sessions/{id}/code': TEACH,
  'GET /attendance-sessions/{id}/code': TEACH,
  'GET /classes/{id}/attendance': TEACH,

  // the Commons: the wall
  'GET /commons/blocks': COMMONS,
  'POST /commons/blocks': COMMONS,
  'DELETE /commons/blocks/{userId}': COMMONS,
  'POST /commons/reports': COMMONS,
  'GET /commons/people': COMMONS,
  'GET /commons/profiles/{userId}': COMMONS,
  'GET /commons/board-posts': COMMONS,
  'POST /commons/board-posts': COMMONS,
  'GET /commons/board-posts/{id}': COMMONS,
  'DELETE /commons/board-posts/{id}': COMMONS,
  'PATCH /commons/board-posts/{id}/status': COMMONS,
  'POST /commons/board-posts/{id}/extend': COMMONS,
  'POST /commons/board-posts/{id}/message': PARTICIPATE,
  'POST /commons/board-posts/{id}/answers': COMMONS,
  'POST /commons/board-posts/{id}/interests': COMMONS,
  'POST /commons/board-posts/{id}/assign': COMMONS,
  'POST /commons/board-posts/{id}/done': COMMONS,
  'POST /commons/board-posts/{id}/claims': COMMONS,
  'POST /commons/board-posts/{id}/claims/{claimId}/confirm': COMMONS,
  'POST /commons/thanks': COMMONS,
  'POST /commons/conversations': COMMONS,
  'GET /commons/conversations': COMMONS,
  'POST /commons/conversations/{id}/respond': COMMONS,
  'GET /commons/conversations/{id}/messages': COMMONS,
  'POST /commons/conversations/{id}/messages': COMMONS,
  'GET /commons/projects': COMMONS,
  'POST /commons/projects': COMMONS,
  'GET /commons/projects/{id}': COMMONS,
  'PATCH /commons/projects/{id}': COMMONS,
  'DELETE /commons/projects/{id}': COMMONS,
  'POST /commons/projects/{id}/join': PARTICIPATE,
  'POST /commons/join-requests/{id}': COMMONS,
  'POST /commons/projects/{id}/updates': COMMONS,
  'GET /commons/card': COMMONS,
  'GET /commons/challenges': COMMONS,
  'POST /commons/challenges': COMMONS,
  'GET /commons/challenges/{id}': COMMONS,
  'POST /commons/challenges/{id}/submissions': COMMONS,
  'POST /commons/submissions/{id}/like': PARTICIPATE,
  'PUT /commons/challenges/{id}/winners': COMMONS,

  // admin: everything under /admin is admins-only
  'GET /admin/institution': ADMIN,
  'PATCH /admin/institution': ADMIN,
  'GET /admin/branches': ADMIN,
  'POST /admin/branches': ADMIN,
  'PATCH /admin/branches/{id}': ADMIN,
  'DELETE /admin/branches/{id}': ADMIN,
  'GET /admin/audit': ADMIN,
  'GET /admin/users': ADMIN,
  'POST /admin/staff-invites': ADMIN,
  'PATCH /admin/users/{id}/status': ADMIN,
  'POST /admin/users/{id}/reset-password': ADMIN,
  'DELETE /admin/users/{id}': ADMIN,
  'PUT /admin/users/{id}/admin': ADMIN,
  'GET /admin/featured': ADMIN,
  'PUT /admin/featured/{type}/{id}': ADMIN,
  'PUT /admin/flagship': ADMIN,
  'GET /admin/inbox': ADMIN,
  'PATCH /admin/tickets/{id}': ADMIN,
  'PATCH /admin/commons/{type}/{id}': ADMIN,
  'DELETE /admin/commons/{type}/{id}': ADMIN,
  'POST /admin/commons/{type}/{id}/hide': ADMIN,
  'POST /admin/commons/{type}/{id}/unhide': ADMIN,
  'POST /admin/reports/{id}': ADMIN,
  'POST /admin/users/{id}/ban': ADMIN,
  'DELETE /admin/users/{id}/ban': ADMIN,
  'GET /admin/conversations': ADMIN,
  'GET /admin/conversations/{id}/messages': ADMIN,
  'GET /admin/overview': ADMIN,
  'PATCH /admin/students/{id}': ADMIN,
  'POST /admin/students/{id}/move': ADMIN,
};

const DAY = new Date().toISOString().slice(0, 10);
const dynamic = { session: '', change: '' }; // real ids, filled in before()
/** Real ids where the handler would otherwise answer 403/404 for the wrong reason; everything else gets 'x'. */
const params = (path: string) =>
  path
    .replace('{id}', path.startsWith('/classes/') ? CLASS : path.startsWith('/attendance-sessions/') ? dynamic.session : 'x')
    .replace('{changeId}', dynamic.change)
    .replace(/\{\w+\}/g, 'x');
/** Valid bodies/queries for the routes whose handler (not the guard) enforces the role. */
const INPUT: Record<string, { body?: object; query?: object }> = {
  'POST /attendance-sessions': { body: { subjectId: SUBJECT, date: DAY } },
  'PUT /attendance-sessions/{id}': { body: { absentIds: [] } },
  'GET /classes/{id}/attendance': { query: { subjectId: SUBJECT } },
  'POST /classes/{id}/changes': { body: { date: DAY, kind: 'extra', subjectId: SUBJECT, start: '07:00', end: '07:30' } },
  'POST /checkin': { body: { code: '0000' } },
};

const ops = Object.entries(openApiDocument().paths!).flatMap(([path, item]) =>
  Object.keys(item as object)
    .filter((m) => ['get', 'post', 'put', 'patch', 'delete'].includes(m))
    .map((m) => ({ key: `${m.toUpperCase()} ${path}`, method: m as 'get', path })),
);

const send = async (who: Who | 'anon', { key, method, path }: (typeof ops)[number]) => {
  const input = INPUT[key] ?? {};
  const a = who === 'anon' ? request(app) : await agent((await db.user.findUniqueOrThrow({ where: { id: WHO[who] } })).email);
  let r = a[method](API + params(path)).query(input.query ?? {});
  if (method !== 'get') r = r.set('Origin', ORIGIN).send(input.body ?? {});
  return (await r).status;
};

const as = async (id: string) => agent((await db.user.findUniqueOrThrow({ where: { id } })).email);

before(async () => {
  resetDb();
  await db.user.update({ where: { id: WHO.banned }, data: { bannedAt: new Date() } });
  const t2 = await as(WHO.subjectTeacher);
  dynamic.session = (await t2.post(`${API}/attendance-sessions`).set('Origin', ORIGIN).send({ subjectId: SUBJECT, date: DAY }).expect(200)).body.id;
  dynamic.change = (await t2.post(`${API}/classes/${CLASS}/changes`).set('Origin', ORIGIN).send(INPUT['POST /classes/{id}/changes']!.body).expect(201)).body.id;
});
after(() => db.$disconnect());

test('every OpenAPI route has a wall entry, and every entry is a real route', () => {
  const keys = new Set(ops.map((o) => o.key));
  assert.deepEqual(ops.map((o) => o.key).filter((k) => !MATRIX[k]), [], 'routes missing from MATRIX: decide who may call them');
  assert.deepEqual(Object.keys(MATRIX).filter((k) => !keys.has(k)), [], 'stale MATRIX entries');
});

test('the matrix holds: default deny, 401 without a live session, allowed = not 401/403', async () => {
  const wrong: string[] = [];
  const check = async (who: Who | 'anon', op: (typeof ops)[number], ok: (s: number) => boolean, want: string) => {
    const status = await send(who, op);
    if (!ok(status)) wrong.push(`${who} ${op.key}: got ${status}, want ${want}`);
  };
  const guarded = ops.filter((o) => MATRIX[o.key] !== PUBLIC);
  // 1. every deny first (they change nothing)...
  for (const op of guarded) {
    const allowed = MATRIX[op.key] as Who[];
    await check('anon', op, (s) => s === 401, '401');
    await check('disabled', op, (s) => s === 401, '401');
    for (const who of ROLES.filter((r) => r !== 'disabled' && !allowed.includes(r))) await check(who, op, (s) => s === 403, '403');
  }
  // 2. ...then the allows, graduate and next-term last because they really close the class.
  const last = (o: (typeof ops)[number]) => /\/(graduate|terms\/next)$/.test(o.path);
  for (const op of [...ops.filter((o) => !last(o)), ...ops.filter(last)]) {
    const allowed = MATRIX[op.key];
    if (allowed === PUBLIC) await check('anon', op, (s) => s !== 401 && s !== 403, 'not 401/403');
    else for (const who of allowed) await check(who, op, (s) => s !== 401 && s !== 403, 'not 401/403');
  }
  assert.deepEqual(wrong, []);
});

test('named walls: teacher on /commons, CR on attendance writes, a student on other students attendance', async () => {
  const hit = async (id: string, m: 'get' | 'post' | 'put' | 'delete', url: string, body: object = {}) => (await (await as(id))[m](API + url).set('Origin', ORIGIN).send(m === 'get' ? undefined : body)).status;
  for (const t of ['t1', 't2', 't3', 't4']) for (const u of ['/commons/board-posts', '/commons/projects', '/commons/people', '/commons/conversations']) assert.equal(await hit(t, 'get', u), 403, `${t} ${u}`);
  for (const m of [['post', '/attendance-sessions', { subjectId: SUBJECT, date: DAY }], ['put', `/attendance-sessions/${dynamic.session}`, { absentIds: [] }], ['post', `/attendance-sessions/${dynamic.session}/code`, {}]] as const)
    assert.equal(await hit(WHO.cr, m[0], m[1], m[2]), 403, `CR ${m[1]}`);
  assert.equal(await hit(WHO.student, 'get', `/classes/${CLASS}/attendance?subjectId=${SUBJECT}`), 403);
  assert.equal(await hit(WHO.outsiderStudent, 'get', `/classes/${CLASS}/attendance?subjectId=${SUBJECT}`), 403);
  // a subject teacher takes attendance for their own subject only
  assert.equal(await hit(WHO.subjectTeacher, 'post', '/attendance-sessions', { subjectId: 'sub6', date: DAY }), 403);
  assert.equal(await hit(WHO.admin, 'delete', '/me', { password: 'campus123' }), 409, 'the chief cannot delete themselves');
  // a banned student loses the Commons but keeps the class space
  assert.equal(await hit(WHO.banned, 'get', '/commons/board-posts'), 403);
  assert.equal(await hit(WHO.banned, 'get', `/classes/${CLASS}/board`), 200);
});

test('admin writes leave an AuditLog row', async () => {
  const a = await as(WHO.admin);
  const writes: [string, 'post' | 'patch' | 'put', string, object][] = [
    ['institution', 'patch', '/admin/institution', { name: 'Demo Institute' }],
    ['branch', 'post', '/admin/branches', { code: 'WALL', name: 'Wall test branch' }],
    ['ban', 'post', '/admin/users/s40/ban', { reason: 'wall test' }],
    ['unfeature', 'put', '/admin/featured/project/pr1', { featured: false }],
    ['board edit', 'post', `/classes/${CLASS}/board`, { kind: 'notice', title: 'Wall test notice' }],
    ['attendance save', 'put', `/attendance-sessions/${dynamic.session}`, { absentIds: ['s32'] }],
  ];
  for (const [what, m, url, body] of writes) {
    const before = await db.auditLog.count();
    const status = (await a[m](API + url).set('Origin', ORIGIN).send(body)).status;
    assert.ok(status >= 200 && status < 300, `${what}: ${status}`);
    assert.ok((await db.auditLog.count()) > before, `${what}: no AuditLog row`);
  }
});
