// FND-03: the prototype's demo world (PROTO data.js:33-265 `build()`, ported 1:1, same PRNG seed=11).
// Idempotent: truncates every app table, then bulk-inserts in one transaction.
// Prototype ids (c1, s1, t1, sub1, pr0, bp1 …) are kept as row ids so cross-references read the same.
// SEED_MODE=prod → institution, branches and the chief only, once, on an empty DB. The chief's address comes from
// SEED_CHIEF_EMAIL (a real inbox you control) and has no password: set it via "forgot password".
// Run: node --env-file=../.env.example --env-file-if-exists=../.env --import tsx prisma/seed.ts
import { Prisma } from '@prisma/client';
import { db } from '../src/lib/db.js';
import { hashPassword, newToken } from '../src/lib/auth.js';
import { today, dow as weekday, addDays } from '../src/lib/dates.js';
import { config } from '../src/config.js';

const DAY = 86_400_000;
const started = Date.now();
const prod = process.env.SEED_MODE === 'prod';

// Calendar dates (@db.Date) are UTC-midnight Dates; timestamps keep the time of day.
const now = new Date();
const d0 = today();
const day = (n: number) => addDays(d0, n);
const ts = (n: number) => new Date(now.getTime() + n * DAY);
// PROTO maps weekends to Monday but keeps today's date; a Monday slot can't change on a Saturday here,
// so the "today" class changes land on the next Monday when today is a weekend.
const classDay = weekday(d0) <= 5 ? d0 : addDays(d0, 8 - weekday(d0));
const dow = weekday(classDay);
const isToday = classDay.getTime() === d0.getTime();

let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const institution = { id: 'i1', name: 'Demo Institute of Technology', timezone: config.INSTITUTION_TZ };
const branches = [
  { id: 'cse', code: 'CSE', name: 'Computer Science & Engineering' },
  { id: 'it', code: 'IT', name: 'Information Technology' },
  { id: 'ece', code: 'ECE', name: 'Electronics & Communication' },
  { id: 'me', code: 'ME', name: 'Mechanical Engineering' },
  { id: 'ie', code: 'IE', name: 'Instrumentation Engineering' },
];
const chief = { id: 'a1', role: 'staff' as const, isAdmin: true, isChief: true, name: 'Office of Academics', email: 'academics@demo.edu', status: 'active' as const };
// The demo cast has a public password and the prod seed truncates, so both are guarded.
if (!prod && config.NODE_ENV === 'production') throw new Error('Refusing the demo seed (password campus123) in production; use SEED_MODE=prod');

async function truncateAll(tx: Prisma.TransactionClient) {
  const tables = Object.values(Prisma.ModelName).map((m) => `"${m}"`).join(', ');
  await tx.$executeRawUnsafe(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

async function seedProd() {
  // A known/demo domain here would let whoever reads that inbox reset the chief's password.
  const email = process.env.SEED_CHIEF_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error('SEED_MODE=prod needs SEED_CHIEF_EMAIL (an inbox you control)');
  if ((await db.user.count()) > 0) throw new Error('SEED_MODE=prod only runs on an empty database');
  await db.$transaction(async (tx) => {
    await tx.institution.create({ data: institution });
    await tx.branch.createMany({ data: branches.map((b) => ({ ...b, institutionId: 'i1' })) });
    await tx.user.create({ data: { ...chief, email, institutionId: 'i1' } });
  });
  console.log(`Seeded (prod): institution, ${branches.length} branches, chief ${email} in ${Date.now() - started}ms`);
}

async function seedDemo() {
  const passwordHash = await hashPassword('campus123'); // scrypt is slow: hash once, reuse

  const teachers = [
    { id: 't1', name: 'Dr. Meera Iyer', email: 'meera.iyer@demo.edu', dept: 'Computer Science' },
    { id: 't2', name: 'Prof. Arjun Rao', email: 'arjun.rao@demo.edu', dept: 'Mathematics' },
    { id: 't3', name: 'Dr. Sana Khan', email: 'sana.khan@demo.edu', dept: 'Physics' },
    { id: 't4', name: 'Prof. David Mathew', email: 'david.mathew@demo.edu', dept: 'Computer Science' },
  ];
  const pendingTeachers = [
    { id: 't9', name: 'Dr. Kavita Menon', email: 'kavita.menon@demo.edu', dept: 'Electronics', requestedAt: ts(-1) },
    { id: 't8', name: 'Prof. Rohan Das', email: 'rohan.das@demo.edu', dept: 'Mechanical', requestedAt: ts(-2) },
  ];

  const first = ['Riya', 'Aarav', 'Sneha', 'Kabir', 'Ananya', 'Ishaan', 'Meher', 'Vivaan', 'Diya', 'Arjun', 'Saanvi', 'Reyansh', 'Tara', 'Neel', 'Myra', 'Dev', 'Kiara', 'Aditya', 'Zara', 'Rohan', 'Aisha', 'Vihaan', 'Nisha', 'Krish', 'Pooja', 'Sameer', 'Ira', 'Yash', 'Leela', 'Omar', 'Fatima', 'Kunal', 'Anika', 'Samar', 'Tanvi', 'Raghav', 'Nora', 'Harsh', 'Maya', 'Aryan'];
  const last = ['Patel', 'Sharma', 'Verma', 'Singh', 'Nair', 'Gupta', 'Reddy', 'Khan', 'Das', 'Joshi', 'Mehta', 'Kapoor', 'Iyer', 'Bose', 'Fernandes', 'Ali', 'Chopra', 'Rao', 'Menon', 'Sinha'];
  type Cls = { id: string; branchId: string; year: number; section: string; name: string; classTeacherId: string; crIds: string[]; teacherIds: string[] };
  const classes: Cls[] = [
    { id: 'c1', branchId: 'cse', year: 2, section: 'A', name: 'CSE · 2nd year · A', classTeacherId: 't1', crIds: ['s1'], teacherIds: ['t1', 't2', 't3', 't4'] },
    { id: 'c2', branchId: 'cse', year: 2, section: 'B', name: 'CSE · 2nd year · B', classTeacherId: 't4', crIds: ['s31'], teacherIds: ['t4', 't1', 't2'] },
    { id: 'c3', branchId: 'ece', year: 1, section: 'A', name: 'ECE · 1st year', classTeacherId: 't3', crIds: ['s51'], teacherIds: ['t3', 't2'] },
  ];
  const ord = ['', '1st', '2nd', '3rd', '4th'];
  for (const b of branches) for (let y = 1; y <= 4; y++) {
    if (classes.some((c) => c.branchId === b.id && c.year === y)) continue;
    // PROTO has no class teacher here; the schema needs one, so a disabled placeholder (t0) holds these classes.
    // Not the chief: /a is for a chief with no classes. Not t1–t4: their class lists must match PROTO.
    classes.push({ id: `c-${b.id}${y}`, branchId: b.id, year: y, section: '', name: `${b.code} · ${ord[y]} year`, classTeacherId: 't0', crIds: [], teacherIds: [] });
  }
  const year = Number(new Intl.DateTimeFormat('en-CA', { timeZone: config.INSTITUTION_TZ, year: 'numeric' }).format(now));
  const batch = (y: number) => String(year - y + 1).slice(2); // 1st year = this year's batch
  const sizes: Record<string, number> = Object.fromEntries(classes.map((c) => [c.id, ({ c1: 30, c2: 20, c3: 16 } as Record<string, number>)[c.id] || 6]));
  const prefix: Record<string, string> = Object.fromEntries(classes.map((c) => [c.id, batch(c.year) + branches.find((b) => b.id === c.branchId)!.code + (c.section || 'A')]));
  type Student = { id: string; name: string; sid: string; email: string; classId: string; status: 'active' | 'invited' };
  const students: Student[] = [];
  let n = 1;
  for (const c of classes) {
    for (let i = 1; i <= sizes[c.id]; i++, n++) {
      const name = n === 1 ? 'Riya Patel' : `${first[(n * 7) % first.length]} ${last[(n * 3) % last.length]}`;
      const sid = `${prefix[c.id]}${String(i).padStart(3, '0')}`;
      students.push({ id: 's' + n, name, sid, email: `${sid.toLowerCase()}@students.demo.edu`, classId: c.id, status: i > sizes[c.id] - 2 ? 'invited' : 'active' });
    }
    n = c.id === 'c1' ? 31 : c.id === 'c2' ? 51 : n;
    if (c.id === 'c3') n = 67;
    for (const st of students.filter((x) => x.classId === c.id)) if (!c.crIds.length && st.status === 'active') { c.crIds.push(st.id); break; }
  }
  const cls = (id: string) => classes.find((c) => c.id === id)!;
  const who = (branchId: string, y: number, i = 0) => students.filter((st) => { const c = cls(st.classId); return c.branchId === branchId && c.year === y && st.status === 'active'; })[i].id;

  const subjects = [
    { id: 'sub1', classId: 'c1', name: 'Data Structures', code: 'CS201', teacherId: 't1' },
    { id: 'sub2', classId: 'c1', name: 'Discrete Mathematics', code: 'MA203', teacherId: 't2' },
    { id: 'sub3', classId: 'c1', name: 'Database Systems', code: 'CS203', teacherId: 't4' },
    { id: 'sub4', classId: 'c1', name: 'Engineering Physics', code: 'PH201', teacherId: 't3' },
    { id: 'sub5', classId: 'c1', name: 'Web Development Lab', code: 'CS251', teacherId: 't1' },
    { id: 'sub6', classId: 'c2', name: 'Data Structures', code: 'CS201', teacherId: 't1' },
    { id: 'sub7', classId: 'c2', name: 'Discrete Mathematics', code: 'MA203', teacherId: 't2' },
    { id: 'sub8', classId: 'c2', name: 'Database Systems', code: 'CS203', teacherId: 't4' },
    { id: 'sub9', classId: 'c3', name: 'Engineering Mathematics I', code: 'MA101', teacherId: 't2' },
    { id: 'sub10', classId: 'c3', name: 'Engineering Physics', code: 'PH101', teacherId: 't3' },
  ];
  const subject = (id: string) => subjects.find((s) => s.id === id)!;
  const termOf = (classId: string) => `term-${classId}`;

  // weekly timetable: [subjectId, dow, start, end, room]
  const tt: [string, number, string, string, string][] = [
    ['sub1', 1, '09:00', '10:00', 'LH-2'], ['sub2', 1, '10:00', '11:00', 'LH-2'], ['sub3', 1, '11:30', '12:30', 'LH-2'], ['sub5', 1, '14:00', '16:00', 'Lab 3'],
    ['sub4', 2, '09:00', '10:00', 'LH-2'], ['sub1', 2, '10:00', '11:00', 'LH-2'], ['sub2', 2, '11:30', '12:30', 'LH-2'],
    ['sub3', 3, '09:00', '10:00', 'LH-2'], ['sub4', 3, '10:00', '11:00', 'LH-2'], ['sub1', 3, '11:30', '12:30', 'LH-2'], ['sub5', 3, '14:00', '16:00', 'Lab 3'],
    ['sub2', 4, '09:00', '10:00', 'LH-2'], ['sub3', 4, '10:00', '11:00', 'LH-2'], ['sub4', 4, '11:30', '12:30', 'LH-2'],
    ['sub1', 5, '09:00', '10:00', 'LH-2'], ['sub3', 5, '10:00', '11:00', 'LH-2'], ['sub2', 5, '11:30', '12:30', 'LH-2'],
    ['sub6', 1, '11:30', '12:30', 'LH-4'], ['sub7', 1, '14:00', '15:00', 'LH-4'], ['sub8', 2, '09:00', '10:00', 'LH-4'], ['sub6', 2, '14:00', '15:00', 'LH-4'],
    ['sub7', 3, '09:00', '10:00', 'LH-4'], ['sub6', 4, '14:00', '15:00', 'LH-4'], ['sub8', 4, '11:30', '12:30', 'LH-4'], ['sub6', 5, '11:30', '12:30', 'LH-4'],
    ['sub9', 1, '15:00', '16:00', 'LH-1'], ['sub10', 2, '11:30', '12:30', 'LH-1'], ['sub9', 3, '12:30', '13:30', 'LH-1'], ['sub10', 4, '14:00', '15:00', 'LH-1'], ['sub9', 5, '14:00', '15:00', 'LH-1'],
  ];
  const timetable = tt.map(([subjectId, weekday, start, end, room], i) => {
    const classId = subject(subjectId).classId;
    return { id: 'tt' + i, termId: termOf(classId), classId, subjectId, weekday, start, end, room };
  });
  const c1Today = timetable.filter((t) => t.classId === 'c1' && t.weekday === dow);
  const cancelled = c1Today[1];
  const cancelledName = subject(cancelled.subjectId).name;
  const when = isToday ? 'today' : 'on Monday';

  // attendance history: 12 sessions per subject; some students are chronically absent so the warnings show
  const sessions: Prisma.AttendanceSessionCreateManyInput[] = [];
  const attendance: Prisma.AttendanceCreateManyInput[] = [];
  for (const sub of subjects) {
    const roster = students.filter((s) => s.classId === sub.classId && s.status === 'active');
    for (let k = 12; k >= 1; k--) {
      const method = k % 4 === 0 ? 'code' : 'roll';
      const id = `se-${sub.id}-${k}`;
      sessions.push({ id, termId: termOf(sub.classId), subjectId: sub.id, date: day(-k * 3), method, savedById: sub.teacherId, savedAt: ts(-k * 3) });
      for (const st of roster) {
        const num = +st.id.slice(1);
        const p = num % 9 === 0 ? 0.66 : num % 5 === 0 ? 0.72 : num === 1 ? (sub.id === 'sub4' ? 0.7 : 0.88) : 0.9;
        attendance.push({ sessionId: id, studentId: st.id, present: rnd() < p, source: method === 'code' ? 'code' : 'teacher' });
      }
    }
  }

  const syl = (body: string) => ({ body, units: body.split(' · ') });
  const board = [
    { id: 'b1', classId: 'c1', kind: 'notice', title: 'Lab records due before mid-sems', body: 'Get your Web Lab record signed by Dr. Iyer before the mid-semester exams.', pinned: true, authorId: 's1', updatedAt: ts(-1) },
    { id: 'b2', classId: 'c1', kind: 'exam', subjectId: 'sub1', title: 'Mid-semester exam: Data Structures', body: 'Units 1–3. Bring your ID card.', date: day(6), authorId: 's1', updatedAt: ts(-3) },
    { id: 'b3', classId: 'c1', kind: 'exam', subjectId: 'sub2', title: 'Mid-semester exam: Discrete Mathematics', body: 'Units 1–2.', date: day(8), authorId: 's1', updatedAt: ts(-3) },
    { id: 'b4', classId: 'c1', kind: 'exam', subjectId: 'sub3', title: 'Quiz 2: Database Systems', body: 'SQL joins and normalisation.', date: day(3), authorId: 's1', updatedAt: ts(-2) },
    { id: 'b5', classId: 'c1', kind: 'deadline', subjectId: 'sub5', title: 'Portfolio website submission', body: 'Deploy and submit the link.', date: day(2), authorId: 's1', updatedAt: ts(-4) },
    { id: 'b6', classId: 'c1', kind: 'syllabus', subjectId: 'sub1', title: 'Data Structures: syllabus', ...syl('Unit 1 Arrays & complexity · Unit 2 Linked lists · Unit 3 Stacks & queues · Unit 4 Trees · Unit 5 Graphs'), fileName: 'CS201-syllabus.pdf', authorId: 's1', updatedAt: ts(-20) },
    { id: 'b7', classId: 'c1', kind: 'syllabus', subjectId: 'sub2', title: 'Discrete Mathematics: syllabus', ...syl('Unit 1 Logic · Unit 2 Sets & relations · Unit 3 Combinatorics · Unit 4 Graph theory'), fileName: 'MA203-syllabus.pdf', authorId: 's1', updatedAt: ts(-20) },
    { id: 'b8', classId: 'c1', kind: 'syllabus', subjectId: 'sub3', title: 'Database Systems: syllabus', ...syl('Unit 1 ER model · Unit 2 Relational algebra · Unit 3 SQL · Unit 4 Normalisation · Unit 5 Transactions'), fileName: 'CS203-syllabus.pdf', authorId: 's1', updatedAt: ts(-20) },
    { id: 'b9', classId: 'c1', kind: 'file', title: 'Web Lab manual', fileName: 'web-lab-manual.pdf', authorId: 's1', updatedAt: ts(-15) },
    { id: 'b10', classId: 'c1', kind: 'file', title: 'Previous year papers (DS + DBMS)', fileName: 'pyq-ds-dbms.zip', authorId: 's1', updatedAt: ts(-9) },
    { id: 'b11', classId: 'c2', kind: 'exam', subjectId: 'sub6', title: 'Mid-semester exam: Data Structures', date: day(6), authorId: 's31', updatedAt: ts(-3) },
    { id: 'b12', classId: 'c2', kind: 'deadline', subjectId: 'sub8', title: 'ER diagram assignment', date: day(4), authorId: 's31', updatedAt: ts(-2) },
    { id: 'b13', classId: 'c3', kind: 'exam', subjectId: 'sub10', title: 'Physics class test', date: day(5), authorId: 's51', updatedAt: ts(-1) },
  ] as const;

  // seen lists cover every target class, so seen rates read sensibly in each class
  const seenSome = (cids: string[], frac: number) => students.filter((s) => s.status === 'active' && cids.includes(s.classId)).map((s) => s.id).filter((_, i) => (i * 37) % 100 < frac * 100);
  const posts = [
    { id: 'p1', authorId: 't1', kind: 'assignment', title: 'Assignment 3: Linked lists', body: 'Implement a doubly linked list with insert, delete and reverse. Submit on GitHub and paste the link.', classIds: ['c1', 'c2'], dueAt: ts(4), createdAt: ts(-2), seen: seenSome(['c1', 'c2'], 0.8).filter((x) => x !== 's1') },
    { id: 'p2', authorId: 't4', kind: 'announcement', title: 'Extra class on Saturday', body: 'Saturday 10 AM, LH-2: revision of SQL joins before the quiz.', classIds: ['c1'], createdAt: ts(-1), seen: seenSome(['c1'], 0.6).filter((x) => x !== 's1') },
    { id: 'p3', authorId: 't2', kind: 'announcement', title: 'Practice sheet uploaded', body: 'Practice sheet for combinatorics is on the board under Files. Try Q1–Q15.', classIds: ['c1', 'c2', 'c3'], createdAt: ts(-4), seen: seenSome(['c1', 'c2', 'c3'], 0.93) },
    { id: 'p4', authorId: 't3', kind: 'announcement', title: 'Lab coats are compulsory', body: 'From next week, no entry to the physics lab without a lab coat.', classIds: ['c1', 'c3'], createdAt: ts(-6), seen: seenSome(['c1', 'c3'], 0.97) },
  ] as const;
  const reminders = [
    { id: 'r1', teacherId: 't1', title: 'Set the DS mid-sem question paper', date: day(3) },
    { id: 'r2', teacherId: 't1', title: 'Review project proposals', date: day(9) },
  ];

  // Commons
  const skillsPool = ['React', 'Node.js', 'Python', 'C++', 'UI design', 'Figma', 'Arduino', 'ML', 'Flutter', 'SQL', 'Java', 'Writing', 'Video editing', 'DSA', 'Linux', 'IoT'];
  const heads = ['Learning backend, want to build real things', 'Competitive programmer, happy to help with DSA', 'Designer who codes a little', 'Into hardware and IoT', 'Building my first Android app', 'Preparing for exams, back soon', 'Open source newbie', 'ML curious, Python comfy'];
  const avail = ['open', 'open', 'questions', 'focus', 'open', 'questions'] as const;
  const profiles = students.map((s) => {
    const k = +s.id.slice(1);
    const a = k === 1 ? 'open' : avail[k % avail.length];
    return {
      userId: s.id,
      headline: k === 1 ? 'CR of CSE-A · building a campus events app · loves React' : heads[k % heads.length],
      availability: a,
      helpsJuniors: k === 1 || (cls(s.classId).year >= 2 && k % 3 === 0),
      focusUntil: a === 'focus' ? ts(10 + (k % 10)) : null,
      skills: k === 1 ? ['React', 'Node.js', 'UI design', 'DSA'] : [skillsPool[k % 16], skillsPool[(k * 5) % 16], skillsPool[(k * 11) % 16]].filter((v, i, x) => x.indexOf(v) === i),
      links: { github: k % 3 ? s.name.split(' ')[0].toLowerCase() + k : '', leetcode: k % 2 ? s.name.split(' ')[0].toLowerCase() + '_' + k : '', linkedin: k % 4 ? s.name.toLowerCase().replace(' ', '-') : '', other: [] },
    };
  });
  const projects = [
    { id: 'pr0', ownerId: who('cse', 4), title: 'Digital Campus · SoET Open Source', description: "This semester's flagship: build the platform you're using right now. Every branch has a role: web and backend (CSE, IT), attendance hardware experiments (ECE, IE), a 3D-printed kiosk stand (ME), plus design, testing and docs. Look for issues labelled good first issue.", roles: ['Frontend', 'Backend', 'Hardware (ECE/IE)', 'CAD (ME)', 'Design', 'Testing', 'Docs'], repo: 'github.com/soet-open-source/digital-campus', status: 'building', featured: true, community: true, flagship: true, members: [{ userId: who('cse', 4), role: 'Maintainer' }, { userId: 's1', role: 'Frontend' }, { userId: who('it', 3), role: 'Backend' }, { userId: who('ece', 3), role: 'Hardware' }, { userId: who('me', 2), role: 'CAD' }, { userId: who('ie', 4), role: 'Sensors' }, { userId: who('it', 1), role: 'Docs' }], createdAt: ts(-25) },
    { id: 'pr1', ownerId: 's1', title: 'Campus Events', description: 'One page that lists every club event and fest happening this month, so nobody misses anything.', roles: ['Frontend', 'Design', 'Content'], repo: 'github.com/riya1/campus-events', status: 'building', featured: true, community: false, members: [{ userId: 's1', role: 'Owner · Frontend' }, { userId: 's7', role: 'Backend' }, { userId: 's33', role: 'Design' }], createdAt: ts(-18) },
    { id: 'pr2', ownerId: 's12', title: 'Library Seat Finder', description: 'IoT sensors on library desks that show free seats live on a web page.', roles: ['Arduino', 'Backend', 'Hardware'], repo: 'github.com/kabir12/seat-finder', status: 'looking', featured: false, community: false, members: [{ userId: 's12', role: 'Owner · Hardware' }, { userId: 's52', role: 'Electronics' }], createdAt: ts(-6) },
    { id: 'pr3', ownerId: 's31', title: 'Notes Hub (community project)', description: 'The student body wants one open notes archive for every subject. Anyone can contribute notes, code or design.', roles: ['Anyone', 'Frontend', 'Moderation', 'Writing'], repo: 'github.com/dc-community/notes-hub', status: 'building', featured: true, community: true, members: [{ userId: 's31', role: 'Owner' }, { userId: 's4', role: 'Frontend' }, { userId: 's9', role: 'Writing' }, { userId: 's55', role: 'Notes' }, { userId: 's18', role: 'Backend' }], createdAt: ts(-30) },
    { id: 'pr4', ownerId: 's20', title: 'Mess Menu Bot', description: 'A tiny bot that posts the daily mess menu and lets students rate meals.', roles: ['Python', 'Bot'], repo: '', status: 'shipped', featured: false, community: false, members: [{ userId: 's20', role: 'Owner' }, { userId: 's24', role: 'Python' }], createdAt: ts(-60) },
    { id: 'pr5', ownerId: 's44', title: 'DSA Study Circle', description: 'Weekly problem sets and a shared tracker. Looking for people who want to grind together.', roles: ['DSA', 'Anyone'], repo: '', status: 'looking', featured: false, community: true, members: [{ userId: 's44', role: 'Owner' }], createdAt: ts(-3) },
    { id: 'pr6', ownerId: 's56', title: 'Solar Bench Monitor', description: 'Measure output from the solar panels on the ECE block and show it on a dashboard.', roles: ['IoT', 'Data viz', 'Electronics'], repo: '', status: 'looking', featured: false, community: false, members: [{ userId: 's56', role: 'Owner' }, { userId: 's60', role: 'Electronics' }], createdAt: ts(-9) },
  ] as const;
  const boardPosts: Prisma.BoardPostCreateManyInput[] = [
    { id: 'bp1', authorId: who('me', 1), kind: 'ask', title: 'Where can I get a drafter for ME graphics?', body: 'First year, ME. Do seniors sell or lend drafters? The shop near the gate is out of stock.', tags: ['ME', 'Drawing'], status: 'open', createdAt: ts(0), expiresAt: ts(14) },
    { id: 'bp2', authorId: 's12', kind: 'ask', title: 'How do I flash an ESP32 from VS Code?', body: 'PlatformIO keeps failing with a port error on Windows. Has anyone fixed this?', tags: ['ESP32', 'IoT'], status: 'solved', createdAt: ts(-2), expiresAt: ts(12) },
    { id: 'bp3', authorId: who('it', 1), kind: 'ask', title: 'Which elective is better in 3rd year: Cloud or ML?', body: 'Asking seniors who took either. Workload, teaching, and usefulness for placements?', tags: ['Electives', 'Advice'], status: 'open', createdAt: ts(-1), expiresAt: ts(13) },
    { id: 'bp4', authorId: who('ece', 2), kind: 'gig', title: 'Logo for our robotics team', body: 'Simple, bold logo for our robo-race team. Need SVG + PNG.', tags: ['Design', 'Figma'], price: 500, priceType: 'fixed', deadline: ts(6), status: 'open', createdAt: ts(-1), expiresAt: ts(6) },
    { id: 'bp5', authorId: who('cse', 4), kind: 'gig', title: 'Help finishing a client landing page (React)', body: "Freelance project. I have the design, need someone to build 2 responsive sections. I'll review your code.", tags: ['React', 'Tailwind'], price: 1500, priceType: 'negotiable', deadline: ts(9), status: 'open', createdAt: ts(-3), expiresAt: ts(9) },
    { id: 'bp6', authorId: who('me', 3), kind: 'gig', title: 'Teach me Python basics (4 sessions)', body: 'Want to automate some CAD calculations. 4 × 1-hour sessions in the library, evenings.', tags: ['Python', 'Tutoring'], price: 800, priceType: 'fixed', deadline: ts(14), status: 'assigned', assigneeId: 's7', createdAt: ts(-5), expiresAt: ts(14) },
    { id: 'bp7', authorId: who('cse', 3), kind: 'market', marketType: 'sell', title: 'Casio fx-991EX calculator', body: 'Used for 2 semesters, works perfectly. Comes with cover.', price: 900, condition: 'Good', place: 'Library entrance', status: 'open', createdAt: ts(-1), expiresAt: ts(29) },
    { id: 'bp8', authorId: who('ie', 4), kind: 'market', marketType: 'give', title: 'Free: 2nd-year Instrumentation books', body: 'Graduating soon. Transducers, Control Systems and Measurements. Free for any IE junior.', price: 0, condition: 'Used', place: 'Department lobby', status: 'open', createdAt: ts(-2), expiresAt: ts(28) },
    { id: 'bp9', authorId: 's20', kind: 'market', marketType: 'buy', title: 'Wanted: lab coat (size M)', body: 'Physics lab next week, need one quickly.', price: 200, condition: 'Any', place: 'Canteen', status: 'open', createdAt: ts(0), expiresAt: ts(30) },
    { id: 'bp10', authorId: who('it', 2), kind: 'market', marketType: 'lend', title: 'Lending: Arduino starter kit for a week', body: 'Uno, breadboard, sensors. Return it in one piece.', price: 0, condition: 'Good', place: 'Lab block', status: 'open', createdAt: ts(-4), expiresAt: ts(26) },
    { id: 'bp11', authorId: who('ece', 1), kind: 'lost', title: 'Blue ID-card holder', body: 'Has my ID and a metro card. Lost between the ECE lab and the canteen.', place: 'ECE lab → canteen', happenedOn: day(-1), status: 'open', createdAt: ts(-1), expiresAt: ts(29) },
    { id: 'bp12', authorId: who('me', 4), kind: 'found', title: 'Found: scientific calculator', body: 'Left behind in LH-2 after the morning lecture.', place: 'LH-2', happenedOn: day(0), holder: 'With me, ME 4th year', hiddenDetail: 'name sticker on the back', status: 'open', createdAt: ts(0), expiresAt: ts(30) },
    { id: 'bp13', authorId: who('it', 4), kind: 'found', title: 'Found: black water bottle', body: 'Steel bottle near the basketball court.', place: 'Basketball court', happenedOn: day(-3), holder: 'Handed to the department office', hiddenDetail: 'dent near the lid', status: 'returned', createdAt: ts(-3), expiresAt: ts(27) },
    { id: 'bp15', authorId: who('it', 2, 1), kind: 'gig', title: 'Write my Physics lab record, ₹300', body: 'Need all 8 experiments written by Monday.', tags: ['Physics'], price: 300, priceType: 'fixed', deadline: ts(3), status: 'open', createdAt: ts(0), expiresAt: ts(3) },
    { id: 'bp14', authorId: 's1', kind: 'ask', title: 'Anyone from ME who can help with a 3D-printed stand?', body: 'For the Digital Campus flagship: a small stand for a classroom tablet. Need someone who knows Fusion 360.', tags: ['CAD', 'Fusion 360'], status: 'open', createdAt: ts(-1), expiresAt: ts(13) },
  ];
  const answers = [
    { id: 'an1', postId: 'bp1', authorId: who('me', 3), body: 'I have an old one. Message me and take it for ₹150. Also check the Market tab, seniors sell them in the first month.', createdAt: ts(0) },
    { id: 'an2', postId: 'bp2', authorId: who('ece', 3), body: 'Install the CP210x driver, then set upload_port in platformio.ini. Hold BOOT while it says "Connecting…".', createdAt: ts(-2) },
    { id: 'an3', postId: 'bp3', authorId: who('cse', 4), body: 'Took ML. Heavier workload, but the project helped in interviews. Cloud is lighter and practical if you like DevOps.', createdAt: ts(-1) },
    { id: 'an4', postId: 'bp3', authorId: who('it', 4), body: 'Cloud. The labs give you real AWS credits, and the certification prep overlaps.', createdAt: ts(0) },
    { id: 'an5', postId: 'bp14', authorId: who('me', 2), body: "I'm on the flagship as CAD! I can model it this weekend. Send me the tablet dimensions.", createdAt: ts(0) },
  ];
  const interests = [
    { postId: 'bp4', userId: 's33', note: 'I did the fest poster. Can share 3 concepts by Friday.', createdAt: ts(0) },
    { postId: 'bp4', userId: who('it', 2), note: 'Figma user, quick turnaround.', createdAt: ts(0) },
    { postId: 'bp5', userId: 's7', note: 'Built two React sites this year, happy to do it.', createdAt: ts(-2) },
  ];
  const thanks = [
    { id: 'th1', fromId: 's12', toId: who('ece', 3), postId: 'bp2', createdAt: ts(-1) },
    { id: 'th2', fromId: who('it', 4), toId: who('cse', 1), postId: 'bp13', createdAt: ts(-2) },
    { id: 'th3', fromId: who('me', 3), toId: 's7', postId: 'bp6', createdAt: ts(-4) },
    { id: 'th4', fromId: who('me', 1), toId: 's1', postId: null, createdAt: ts(-8) },
    { id: 'th5', fromId: who('it', 1), toId: 's1', postId: null, createdAt: ts(-12) },
  ];
  const joinRequests = [
    { id: 'jr1', projectId: 'pr1', userId: 's14', note: 'I know Figma and can help with the event cards.', state: 'pending' as const, createdAt: ts(-1) },
    { id: 'jr2', projectId: 'pr1', userId: 's40', note: 'Want to learn React, can do content.', state: 'pending' as const, createdAt: ts(0) },
  ];
  const updates = [
    { id: 'u1', projectId: 'pr1', authorId: 's1', body: 'Event list page done, with filters by club.', source: 'manual' as const, createdAt: ts(-1) },
    { id: 'u2', projectId: 'pr1', authorId: 's7', body: 'feat: /events API with pagination', source: 'github' as const, createdAt: ts(-1) },
    { id: 'u3', projectId: 'pr1', authorId: 's33', body: 'New card design in Figma, shared in the repo wiki.', source: 'manual' as const, createdAt: ts(-3) },
    { id: 'u4', projectId: 'pr1', authorId: 's7', body: 'fix: date timezone bug', source: 'github' as const, createdAt: ts(-4) },
    { id: 'u5', projectId: 'pr3', authorId: 's4', body: 'feat: subject search', source: 'github' as const, createdAt: ts(-2) },
    { id: 'u6', projectId: 'pr3', authorId: 's9', body: 'Uploaded DBMS unit 1–3 notes.', source: 'manual' as const, createdAt: ts(-2) },
    { id: 'u7', projectId: 'pr2', authorId: 's12', body: 'First sensor prototype reads distance reliably.', source: 'manual' as const, createdAt: ts(-2) },
    { id: 'u8', projectId: 'pr4', authorId: 's20', body: 'Shipped v1! 180 students use it daily.', source: 'manual' as const, createdAt: ts(-20) },
  ];
  const challenges = [
    { id: 'ch1', ownerId: 's7', title: 'Weekend build: a timetable widget', description: 'Build the prettiest one-screen timetable widget. Any stack.', endsAt: ts(2), judging: 'likes' as const, winnerIds: [] as string[], submissions: [{ id: 'sb1', userId: 's7', url: 'tt-widget.vercel.app', note: 'Glassmorphism, sorry', likes: ['s2', 's3', 's1'] }, { id: 'sb2', userId: 's22', url: 'github.com/x/widget', note: 'Terminal style', likes: ['s5'] }] },
    { id: 'ch2', ownerId: 's44', title: '30-day LeetCode streak', description: 'Solve at least one problem a day for 30 days. Post your profile link.', endsAt: ts(21), judging: 'owner' as const, winnerIds: [], submissions: [{ id: 'sb3', userId: 's44', url: 'leetcode.com/u/samar', note: 'Day 9', likes: [] }, { id: 'sb4', userId: 's1', url: 'leetcode.com/u/riya_1', note: 'Day 9 too', likes: ['s44'] }] },
    { id: 'ch3', ownerId: 's20', title: 'Fest poster design', description: 'Design the poster for the annual tech fest. The winner gets printed!', endsAt: ts(-2), judging: 'owner' as const, winnerIds: ['s33'], submissions: [{ id: 'sb5', userId: 's33', url: 'figma.com/f/poster', note: '', likes: ['s1', 's7', 's20'] }] },
  ];
  const conversations = [
    { id: 'cv1', fromId: 's12', toId: 's1', note: 'Hey Riya, could you review my project idea for the seat finder frontend?', state: 'requested' as const, createdAt: ts(0), messages: [] as { senderId: string; body: string; at: Date }[] },
    { id: 'cv2', fromId: 's1', toId: 's7', note: 'Want to build the events API together?', state: 'accepted' as const, createdAt: ts(-20), messages: [{ senderId: 's7', body: 'Yes! Node + Postgres?', at: ts(-20) }, { senderId: 's1', body: 'Perfect. I will set up the repo.', at: ts(-20) }, { senderId: 's7', body: 'Pushed the first API route 🚀', at: ts(-1) }] },
  ];
  const reports = [
    { id: 'rp1', reporterId: 's5', targetType: 'project' as const, targetId: 'pr4', reason: 'Bot posts the menu at 3 AM, spammy', createdAt: ts(-1) },
    { id: 'rp3', reporterId: 's8', targetType: 'board' as const, targetId: 'bp15', reason: 'Academic dishonesty: a Gig asked someone to write their lab record for ₹300', createdAt: ts(0) },
    { id: 'rp2', reporterId: 's16', targetType: 'message' as const, targetId: 'cv9', reason: 'Repeated unwanted requests', createdAt: ts(-2) },
  ];
  // PROTO audit/notifications are display strings; here they become action/target + typed payloads.
  const audit = [
    { id: 'al1', actorId: 's1', classId: 'c1', action: 'board.exam.create', targetType: 'BoardItem', targetId: 'b4', after: { title: 'Quiz 2: Database Systems' }, createdAt: ts(-2) },
    { id: 'al2', actorId: 's1', classId: 'c1', action: 'schedule.cancel', targetType: 'ScheduleChange', targetId: 'sc1', after: { subject: cancelledName, date: classDay.toISOString().slice(0, 10) }, createdAt: ts(0) },
    { id: 'al3', actorId: 't1', classId: 'c1', action: 'class.cr.set', targetType: 'User', targetId: 's1', after: { name: 'Riya Patel' }, createdAt: ts(-40) },
  ];
  const notifications = [
    { id: 'n1', userId: 's1', type: 'class-change', payload: { text: `${cancelledName} is cancelled ${when}`, classId: 'c1', changeId: 'sc1' }, createdAt: ts(0), readAt: null },
    { id: 'n2', userId: 's1', type: 'message-request', payload: { text: 'Kabir Gupta sent you a message request', conversationId: 'cv1' }, createdAt: ts(0), readAt: null },
    { id: 'n4', userId: 's1', type: 'board-answer', payload: { text: 'Someone from ME answered your Ask about a 3D-printed stand', postId: 'bp14' }, createdAt: ts(0), readAt: null },
    { id: 'n3', userId: 's1', type: 'post', payload: { text: 'Dr. Meera Iyer posted Assignment 3', postId: 'p1' }, createdAt: ts(-2), readAt: ts(-2) },
  ];

  // ─── insert ───
  const inviteLinks: string[] = [];
  const invite = (email: string, role: 'student' | 'staff', invitedById: string, classId: string | null, createdAt: Date) => {
    const { token, tokenHash } = newToken();
    if (role === 'staff') inviteLinks.push(`${email}: ${config.APP_URL}/invite/${token}`);
    return { email, role, classId, invitedById, tokenHash, expiresAt: new Date(createdAt.getTime() + 14 * DAY), createdAt };
  };
  const invited = students.filter((s) => s.status === 'invited');

  await db.$transaction(
    async (tx) => {
      await truncateAll(tx);
      await tx.institution.create({ data: institution });
      await tx.branch.createMany({ data: branches.map((b) => ({ ...b, institutionId: 'i1' })) });
      await tx.user.createMany({
        data: [
          { ...chief, institutionId: 'i1', passwordHash },
          { id: 't0', institutionId: 'i1', role: 'staff' as const, status: 'disabled' as const, name: 'Class office', email: 'class-office@demo.edu' },
          ...teachers.map((t) => ({ ...t, institutionId: 'i1', role: 'staff' as const, status: 'active' as const, passwordHash })),
          ...pendingTeachers.map(({ requestedAt, ...t }) => ({ ...t, institutionId: 'i1', role: 'staff' as const, createdAt: requestedAt })),
        ],
      });
      await tx.class.createMany({ data: classes.map((c) => ({ id: c.id, institutionId: 'i1', branchId: c.branchId, admissionYear: year - c.year + 1, section: c.section, name: c.name, classTeacherId: c.classTeacherId })) });
      await tx.term.createMany({ data: classes.map((c) => ({ id: termOf(c.id), classId: c.id, semester: c.year * 2 - 1, yearOfStudy: c.year, startedAt: ts(-60) })) });
      await tx.user.createMany({
        data: students.map((s) => ({ id: s.id, institutionId: 'i1', role: 'student' as const, name: s.name, email: s.email, status: s.status, passwordHash: s.status === 'active' ? passwordHash : null, homeClassId: s.classId, studentIdNo: s.sid })),
      });
      await tx.invite.createMany({
        data: [
          ...pendingTeachers.map((t) => invite(t.email, 'staff', 'a1', null, t.requestedAt)),
          ...invited.map((s) => invite(s.email, 'student', cls(s.classId).classTeacherId, s.classId, ts(-3))),
        ],
      });
      await tx.classMember.createMany({
        data: classes.flatMap((c) => [
          ...students.filter((s) => s.classId === c.id).map((s) => ({ classId: c.id, userId: s.id, role: c.crIds.includes(s.id) ? ('cr' as const) : ('student' as const) })),
          ...c.teacherIds.map((userId) => ({ classId: c.id, userId, role: 'teacher' as const })),
        ]),
      });
      await tx.subject.createMany({ data: subjects.map((s) => ({ ...s, termId: termOf(s.classId), assignedById: cls(s.classId).classTeacherId })) });
      await tx.timetableSlot.createMany({ data: timetable });
      await tx.scheduleChange.createMany({
        data: [
          { id: 'sc1', classId: 'c1', termId: termOf('c1'), date: classDay, slotId: cancelled.id, subjectId: cancelled.subjectId, kind: 'cancelled', note: 'Teacher is away at a conference. Use the hour for lab records.', authorId: 's1' },
          // Not in PROTO: a make-up class that overlaps the day's first slot, so the clash UI has data.
          { id: 'sc2', classId: 'c1', termId: termOf('c1'), date: classDay, kind: 'extra', subjectId: cancelled.subjectId, title: `Make-up class: ${cancelledName}`, start: '09:30', end: '10:30', room: 'LH-3', authorId: subject(cancelled.subjectId).teacherId },
        ],
      });
      await tx.attendanceSession.createMany({ data: sessions });
      await tx.attendance.createMany({ data: attendance });
      await tx.boardItem.createMany({ data: board.map((b) => ({ ...b, termId: b.kind === 'notice' || b.kind === 'file' ? null : termOf(b.classId) })) });
      await tx.post.createMany({ data: posts.map(({ classIds, seen, ...p }) => p) });
      await tx.postTarget.createMany({ data: posts.flatMap((p) => p.classIds.map((classId) => ({ postId: p.id, classId }))) });
      await tx.postSeen.createMany({ data: posts.flatMap((p) => p.seen.map((userId) => ({ postId: p.id, userId, seenAt: p.createdAt }))) });
      await tx.reminder.createMany({ data: reminders });
      await tx.profile.createMany({ data: profiles });
      await tx.boardPost.createMany({ data: boardPosts });
      await tx.answer.createMany({ data: answers });
      await tx.interest.createMany({ data: interests });
      await tx.thanks.createMany({ data: thanks });
      await tx.project.createMany({ data: projects.map(({ members, repo, ...p }) => ({ ...p, roles: [...p.roles], repoUrl: repo || null })) });
      await tx.projectMember.createMany({ data: projects.flatMap((p) => p.members.map((m) => ({ projectId: p.id, ...m }))) });
      await tx.joinRequest.createMany({ data: joinRequests });
      await tx.projectUpdate.createMany({ data: updates });
      await tx.challenge.createMany({ data: challenges.map(({ submissions, ...c }) => c) });
      await tx.submission.createMany({ data: challenges.flatMap((c) => c.submissions.map(({ likes, ...s }) => ({ ...s, challengeId: c.id }))) });
      await tx.submissionLike.createMany({ data: challenges.flatMap((c) => c.submissions.flatMap((s) => s.likes.map((userId) => ({ submissionId: s.id, userId })))) });
      await tx.conversation.createMany({ data: conversations.map(({ messages, ...c }) => c) });
      await tx.message.createMany({ data: conversations.flatMap((c) => c.messages.map((m, i) => ({ conversationId: c.id, senderId: m.senderId, body: m.body, createdAt: new Date(m.at.getTime() + i * 60_000) }))) });
      await tx.report.createMany({ data: reports });
      // Not in PROTO: one student ticket so the admin inbox has data.
      await tx.ticket.create({ data: { id: 'tk1', fromId: 's8', category: 'attendance', subject: 'Marked absent in Data Structures', body: 'I was in the Data Structures class last week but the code would not accept my entry. Could my attendance be corrected?', createdAt: ts(-1) } });
      await tx.auditLog.createMany({ data: audit });
      await tx.notification.createMany({ data: notifications });
    },
    { timeout: 60_000 },
  );

  const counts = await Promise.all(Object.values(Prisma.ModelName).map(async (m) => [m, Number((await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${m}"`))[0].n)] as const));
  console.log(Object.fromEntries(counts.filter(([, c]) => c > 0)));
  console.log(`Class day ${classDay.toISOString().slice(0, 10)} (weekday ${dow}): ${cancelledName} cancelled, make-up 09:30-10:30 clashes with slot ${c1Today[0].id}`);
  console.log(`Pending teacher invites:\n  ${inviteLinks.join('\n  ')}`);
  console.log(`Seeded the demo world in ${Date.now() - started}ms. Password for every active account: campus123`);
}

(prod ? seedProd() : seedDemo())
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
