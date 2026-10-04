import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { db } from '../src/lib/db.js';
import { normDate, normTime, normWeekday } from '../src/modules/classes/imports/match.js';
import { agent, resetDb } from './helpers.js';

before(resetDb);
after(() => db.$disconnect());

const base = '/api/v1/classes/c1/imports';
type Draft = {
  subjects: { name: string; teacherName: string | null; teacherId: string | null; issue?: string }[];
  slots: { subject: string; weekday: number; start: string; end: string; issue?: string }[];
};

// A realistic, sloppy ChatGPT/Gemini reply for a timetable photo: chatter, ```json fence, 12-hour times, weekday abbreviations, titles.
const chatbot = `Sure! Here is the timetable I extracted from your photo:

\`\`\`json
{
  "subjects": [
    {"name": "Data Structures", "code": "CS201", "teacherName": "Dr. Meera Iyer"},
    {"name": "Computer Networks", "code": "CS301", "teacherName": "Mathew"},
    {"name": "Discrete Mathematics", "code": null, "teacherName": "Prof Rao"},
    {"name": "Engineering Physics", "teacherName": "Dr. Zed Nobody"}
  ],
  "slots": [
    {"subject": "Data Structures", "weekday": "Mon", "start": "9:00 am", "end": "10:00 am", "room": "LH-2"},
    {"subject": "Computer Networks", "weekday": "Tues", "start": "2.30 pm", "end": "4 PM", "room": null},
    {"subject": "Discrete Mathematics", "weekday": "Thursday", "start": "11:30", "end": "12:30"},
    {"subject": "Engineering Physics", "weekday": "Fri", "start": "25:00", "end": "10:00"},
    {"subject": "Maths Tutorial", "weekday": "Sat", "start": "10:00 AM", "end": "11:00 AM"}
  ]
}
\`\`\`

Let me know if anything looks off!`;

test('normalisers: times, weekdays, dates', () => {
  assert.deepEqual(['9:00 am', '2.30pm', '12 AM', '12:15 pm', '14:00', '9', '25:00', '13 pm', 'noon'].map(normTime), ['09:00', '14:30', '00:00', '12:15', '14:00', '09:00', null, null, null]);
  assert.deepEqual(['Mon', 'tuesday', 'Thurs', 'SAT', 3, 'Sunday', 'x'].map(normWeekday), [1, 2, 4, 6, 3, null, null]);
  assert.deepEqual(['2026-11-05', '05/11/2026', '31-02-2026', '5 Nov 2026', 'soon'].map(normDate), ['2026-11-05', '2026-11-05', null, '2026-11-05', null]);
});

test('prompts for all three kinds; a student → 403 on all three endpoints', async () => {
  const cr = await agent('cr');
  const p = (await cr.get(`${base}/prompts`).expect(200)).body;
  for (const k of ['timetable', 'syllabus', 'datesheet']) assert.match(p[k], /ONLY the JSON/);
  const student = await agent((await db.classMember.findFirstOrThrow({ where: { classId: 'c1', role: 'student' }, include: { user: true } })).user.email);
  await student.get(`${base}/prompts`).expect(403);
  await student.post(`${base}/preview`).send({ kind: 'syllabus', data: '{"subjects":[]}' }).expect(403);
  await student.post(`${base}/apply`).send({ kind: 'syllabus', draft: { subjects: [] } }).expect(403);
});

test('preview: bad JSON / wrong shape → 422 with a readable message', async () => {
  const cr = await agent('cr');
  const notJson = (await cr.post(`${base}/preview`).send({ kind: 'timetable', data: 'I could not read the photo, sorry.' }).expect(422)).body;
  assert.match(notJson.error.message, /not valid JSON/);
  const wrong = (await cr.post(`${base}/preview`).send({ kind: 'timetable', data: '{"subjects":[{"code":"X"}],"slots":[]}' }).expect(422)).body;
  assert.match(wrong.error.message, /subjects\[0\]\.name/);
  await cr.post(`${base}/preview`).send({ kind: 'nope', data: '{}' }).expect(422);
});

test('preview: the fenced, sloppy chatbot reply becomes a normalised draft with matched teachers and flagged rows', async () => {
  const cr = await agent('cr');
  const { draft, summary } = (await cr.post(`${base}/preview`).send({ kind: 'timetable', data: chatbot }).expect(200)).body as { draft: Draft; summary: unknown };
  console.log(JSON.stringify(draft, null, 1));
  assert.deepEqual(draft.subjects.map((s) => [s.name, s.teacherId, s.issue]), [
    ['Data Structures', 't1', undefined],
    ['Computer Networks', 't4', undefined], // "Mathew" ~ Prof. David Mathew
    ['Discrete Mathematics', 't2', undefined], // "Prof Rao" ~ Prof. Arjun Rao
    ['Engineering Physics', null, 'unmatched-teacher'],
  ]);
  assert.deepEqual(draft.slots.map((s) => [s.weekday, s.start, s.end, s.issue]), [
    [1, '09:00', '10:00', undefined],
    [2, '14:30', '16:00', undefined],
    [4, '11:30', '12:30', undefined],
    [5, '25:00', '10:00', 'bad-time'],
    [6, '10:00', '11:00', 'unknown-subject'],
  ]);
  assert.deepEqual(summary, { counts: { subjects: 4, slots: 5 }, issues: { 'unmatched-teacher': 1, 'bad-time': 1, 'unknown-subject': 1 } });
  assert.equal(await db.subject.count({ where: { classId: 'c1' } }), 5); // stateless
});

test('apply timetable: rows with issues → 422 and nothing is written; a fixed draft writes subjects + slots + notifications', async () => {
  const cr = await agent('cr');
  const { draft } = (await cr.post(`${base}/preview`).send({ kind: 'timetable', data: chatbot }).expect(200)).body as { draft: Draft };
  const [subjects, slots, notes] = [() => db.subject.count({ where: { classId: 'c1' } }), () => db.timetableSlot.count({ where: { classId: 'c1' } }), () => db.notification.count({ where: { type: 'subject-allotted' } })];
  const before = [await subjects(), await slots(), await notes()];
  await cr.post(`${base}/apply`).send({ kind: 'timetable', draft }).expect(422);
  await cr.post(`${base}/apply`).send({ kind: 'timetable', draft: { ...draft, subjects: [{ name: 'X', teacherId: 'a-student-id' }], slots: [] } }).expect(422); // not staff
  assert.deepEqual([await subjects(), await slots(), await notes()], before);

  // The CR edits the draft: fixes the bad time, drops the unknown-subject row, and picks Dr. Sana Khan (t3) for Physics.
  const fixed = {
    subjects: draft.subjects.map((s) => (s.name === 'Engineering Physics' ? { ...s, teacherId: 't3' } : s)),
    slots: draft.slots.filter((s) => s.issue !== 'unknown-subject').map((s) => (s.issue ? { ...s, start: '9:00 am', end: '10:00' } : s)),
  };
  const res = (await cr.post(`${base}/apply`).send({ kind: 'timetable', draft: fixed }).expect(200)).body;
  assert.deepEqual(res, { kind: 'timetable', counts: { subjects: 4, slots: 4 } });
  assert.equal(await subjects(), 6); // Computer Networks is new; the other three matched by name
  const cn = await db.subject.findFirstOrThrow({ where: { classId: 'c1', name: 'Computer Networks' } });
  assert.deepEqual([cn.teacherId, cn.code], ['t4', 'CS301']);
  assert.equal(await slots(), 4);
  assert.equal(await db.notification.count({ where: { userId: 't4', type: 'subject-allotted', payload: { path: ['subjectId'], equals: cn.id } } }), 1);
  assert.equal(await db.notification.count({ where: { userId: 't1', type: 'subject-allotted', createdAt: { gte: new Date(Date.now() - 60_000) } } }), 0); // Data Structures unchanged
  assert.equal((await db.subject.findFirstOrThrow({ where: { classId: 'c1', name: 'Engineering Physics' } })).teacherId, 't3');
  assert.equal(await db.auditLog.count({ where: { classId: 'c1', action: { in: ['import.timetable', 'timetable.replace', 'subject.create'] } } }), 3);
});

test('syllabus: preview matches subjects, apply makes syllabus board items with units', async () => {
  const cr = await agent('cr');
  const data = { subjects: [{ name: 'data structures', units: ['Arrays', 'Trees'] }, { name: 'Basket Weaving', units: ['Reeds'] }] };
  const { draft } = (await cr.post(`${base}/preview`).send({ kind: 'syllabus', data }).expect(200)).body;
  assert.deepEqual(draft.subjects.map((s: { subjectId: string | null; issue?: string }) => [s.subjectId, s.issue]), [['sub1', undefined], [null, 'unknown-subject']]);
  await cr.post(`${base}/apply`).send({ kind: 'syllabus', draft }).expect(422);
  const res = (await cr.post(`${base}/apply`).send({ kind: 'syllabus', draft: { subjects: [draft.subjects[0]] } }).expect(200)).body;
  assert.deepEqual(res.counts, { items: 1 });
  const item = await db.boardItem.findFirstOrThrow({ where: { classId: 'c1', kind: 'syllabus', title: 'data structures syllabus' } });
  assert.deepEqual([item.subjectId, item.units], ['sub1', ['Arrays', 'Trees']]);
});

test('datesheet: dates normalise, a bad date blocks apply, apply creates exam items and tells the class', async () => {
  const cr = await agent('cr');
  const data = '```json\n{"exams":[{"subject":"Database Systems","title":"End-sem DBMS","date":"05/12/2026","note":"10 am"},{"subject":"Discrete Mathematics","title":"End-sem DM","date":"someday"}]}\n```';
  const { draft } = (await cr.post(`${base}/preview`).send({ kind: 'datesheet', data }).expect(200)).body;
  assert.deepEqual(draft.exams.map((e: { date: string; subjectId: string; issue?: string }) => [e.date, e.subjectId, e.issue]), [['2026-12-05', 'sub3', undefined], ['someday', 'sub2', 'bad-date']]);
  await cr.post(`${base}/apply`).send({ kind: 'datesheet', draft }).expect(422);
  const notes = await db.notification.count({ where: { type: 'board-item' } });
  await cr.post(`${base}/apply`).send({ kind: 'datesheet', draft: { exams: [draft.exams[0]] } }).expect(200);
  const exam = await db.boardItem.findFirstOrThrow({ where: { classId: 'c1', title: 'End-sem DBMS' } });
  assert.deepEqual([exam.kind, exam.subjectId, exam.date?.toISOString().slice(0, 10), exam.body], ['exam', 'sub3', '2026-12-05', '10 am']);
  assert.ok((await db.notification.count({ where: { type: 'board-item' } })) > notes);
});
