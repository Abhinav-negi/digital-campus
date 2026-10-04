import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { db } from '../src/lib/db.js';
import { agent, resetDb } from './helpers.js';

// Seed c1: Riya (s1) is the CR, Meera (t1) the class teacher, Arjun (t2) teaches a subject there, s2 is a plain student.
before(resetDb);
after(() => db.$disconnect());

const url = '/api/v1/classes/c1/board';
const ids = (items: { id: string }[]) => items.map((i) => i.id);
const plainStudent = async () => agent((await db.user.findUniqueOrThrow({ where: { id: 's2' } })).email);

test('GET board: sections sorted, empty ones are []', async () => {
  const b = (await (await plainStudent()).get(url).expect(200)).body;
  assert.deepEqual(ids(b.notices), ['b1']);
  assert.deepEqual(ids(b.exams), ['b4', 'b2', 'b3']); // soonest first
  assert.deepEqual(ids(b.syllabus).sort(), ['b6', 'b7', 'b8']);
  assert.equal(b.exams[0].subject.name, 'Database Systems');
  assert.deepEqual((await (await agent('admin')).get('/api/v1/classes/c-cse1/board').expect(200)).body, { notices: [], exams: [], deadlines: [], syllabus: [], files: [] });
  await (await agent('subjectTeacher')).get('/api/v1/classes/c-cse1/board').expect(403); // not on that class
});

test('the CR creates, edits and deletes, with an audit row each; a new exam notifies the class', async () => {
  const cr = await agent('cr');
  await cr.post(url).send({ kind: 'exam', title: 'Lab viva' }).expect(422); // no date
  await cr.post(url).send({ kind: 'exam', title: 'Lab viva', date: '2026-12-01', subjectId: 'sub6' }).expect(422); // c2's subject

  const item = (await cr.post(url).send({ kind: 'exam', title: 'Lab viva', date: '2026-12-01', subjectId: 'sub5', body: 'Bring records' }).expect(201)).body;
  assert.deepEqual([item.date, item.subject.id, item.author.id, item.termId], ['2026-12-01', 'sub5', 's1', 'term-c1']);
  assert.ok(await db.notification.findFirst({ where: { userId: 's2', type: 'board-item', payload: { path: ['itemId'], equals: item.id } } }));
  assert.equal(await db.notification.count({ where: { userId: 's1', type: 'board-item' } }), 0); // not the author

  const edited = (await cr.patch(`${url}/${item.id}`).send({ title: 'Web Lab viva', body: null }).expect(200)).body;
  assert.deepEqual([edited.title, edited.body, edited.date], ['Web Lab viva', null, '2026-12-01']);
  await cr.patch(`${url}/${item.id}`).send({ date: null }).expect(422); // an exam keeps its date
  await cr.delete(`${url}/${item.id}`).expect(204);
  await cr.delete(`${url}/${item.id}`).expect(404);

  const log = await db.auditLog.findMany({ where: { targetId: item.id }, orderBy: { createdAt: 'asc' } });
  assert.deepEqual(log.map((a) => a.action), ['board.exam.create', 'board.exam.update', 'board.exam.delete']);
  assert.deepEqual([(log[1]!.before as { title: string }).title, (log[1]!.after as { title: string }).title], ['Lab viva', 'Web Lab viva']);

  const hist = (await cr.get(`/api/v1/classes/c1/history?targetId=${item.id}`).expect(200)).body;
  assert.deepEqual(hist.items.map((h: { action: string }) => h.action), ['board.exam.delete', 'board.exam.update', 'board.exam.create']);
  assert.equal(hist.items[0].actor.name, 'Riya Patel');
});

test('a student → 403; a member teacher reads but cannot edit; the class teacher can', async () => {
  const s2 = await plainStudent();
  const t2 = await agent('subjectTeacher');
  const note = { kind: 'notice', title: 'Fest on Friday', pinned: true };
  await s2.post(url).send(note).expect(403);
  await s2.patch(`${url}/b1`).send({ title: 'x' }).expect(403);
  await s2.get('/api/v1/classes/c1/history').expect(403);
  await t2.get(url).expect(200);
  await t2.post(url).send(note).expect(403);
  await t2.delete(`${url}/b1`).expect(403);
  await t2.get('/api/v1/classes/c1/history').expect(403);

  const t1 = await agent('teacher');
  const n = (await t1.post(url).send(note).expect(201)).body;
  assert.deepEqual([n.pinned, n.termId], [true, null]); // notices carry across terms
  await t1.patch(`${url}/b1`).send({ pinned: false }).expect(200);
  assert.deepEqual(ids((await s2.get(url).expect(200)).body.notices), [n.id, 'b1']); // pinned first
  assert.ok((await t1.get('/api/v1/classes/c1/history?limit=5').expect(200)).body.items.length > 0);
});

test('files: own uploads only, read back as a presigned URL', async () => {
  const cr = await agent('cr');
  await cr.post(url).send({ kind: 'file', title: 'Lab manual' }).expect(422);
  await cr.post(url).send({ kind: 'file', title: 'Lab manual', fileKey: 'uploads/t1/abc-manual.pdf' }).expect(422); // someone else's
  await cr.post(url).send({ kind: 'file', title: 'Lab manual', fileKey: 'uploads/s1/../t1/abc-manual.pdf' }).expect(422);
  const f = (await cr.post(url).send({ kind: 'file', title: 'Lab manual', fileKey: 'uploads/s1/abc-manual.pdf', fileName: 'manual.pdf' }).expect(201)).body;
  assert.equal(f.fileName, 'manual.pdf');
  assert.match(f.fileUrl, /\/files\/local\/uploads\/s1\/abc-manual\.pdf\?exp=\d+&sig=/);
  // The class teacher edits the CR's file item without re-uploading it.
  const v2 = (await (await agent('teacher')).patch(`${url}/${f.id}`).send({ title: 'Web Lab manual v2', fileKey: 'uploads/s1/abc-manual.pdf' }).expect(200)).body;
  assert.equal(v2.fileName, 'manual.pdf');
});

test("from-post: the CR turns a teacher's post into a deadline", async () => {
  const cr = await agent('cr');
  const from = `${url}/from-post`;
  await cr.post(from).send({ postId: 'p1', kind: 'deadline', title: 'Assignment 3', date: '2026-12-05' }).expect(201);
  const b = (await cr.get(url).expect(200)).body;
  const d = b.deadlines.find((x: { title: string }) => x.title === 'Assignment 3');
  assert.match(d.body, /doubly linked list/);
  await cr.post('/api/v1/classes/c2/board/from-post').send({ postId: 'p2', kind: 'exam', title: 'x', date: '2026-12-05' }).expect(403); // not c2's CR
  await (await agent('admin')).post('/api/v1/classes/c2/board/from-post').send({ postId: 'p2', kind: 'exam', title: 'x', date: '2026-12-05' }).expect(404); // p2 isn't sent to c2
});

test('history shows board rows only; a non-board targetId → 404', async () => {
  const cr = await agent('cr');
  const all = (await cr.get('/api/v1/classes/c1/history?limit=100').expect(200)).body.items;
  assert.ok(all.length > 0);
  assert.ok(all.every((h: { action: string; targetType: string }) => h.action.startsWith('board.') && h.targetType === 'BoardItem')); // seed also has schedule.cancel, class.cr.set
  await cr.get('/api/v1/classes/c1/history?targetId=s1').expect(404); // the class.cr.set row's target
  await cr.get('/api/v1/classes/c1/history?targetId=sc1').expect(404); // a schedule change
  await cr.get('/api/v1/classes/c1/history?targetId=b11').expect(404); // c2's board item
  assert.deepEqual((await cr.get('/api/v1/classes/c1/history?targetId=b4').expect(200)).body.items.map((h: { action: string }) => h.action), ['board.exam.create']);
  await (await plainStudent()).get('/api/v1/classes/c1/history?targetId=s1').expect(403);
});
