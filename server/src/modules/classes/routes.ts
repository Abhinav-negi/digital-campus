import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../../lib/audit.js';
import { auth, classAccess, staff } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { HttpError, notImplemented, page, pageQuery, paginate } from '../../lib/http.js';
import { notify } from '../../lib/notify.js';
import { registry, route } from '../../lib/openapi.js';
import { activeTerm, classAudience, className, classSummary, listClasses, semesterFor, writable, yearOf } from './service.js';

// CS-01: classes + terms. Later CS tasks add sub-routers for /classes/:id/… (see the bottom of the file).

const person = z.object({ id: z.string(), name: z.string() });
const classCard = z
  .object({
    id: z.string(),
    name: z.string(),
    branch: z.object({ id: z.string(), code: z.string(), name: z.string() }),
    admissionYear: z.number().int(),
    section: z.string(),
    minAttendancePct: z.number().int(),
    archivedAt: z.string().nullable(),
    classTeacher: person,
    termId: z.string(),
    semester: z.number().int(),
    yearOfStudy: z.number().int(),
    termLabel: z.string(),
    counts: z.object({ students: z.number().int(), subjects: z.number().int() }),
    crs: z.array(person),
    myRole: z.enum(['classTeacher', 'teacher', 'cr', 'student']).nullable(),
  })
  .meta({ id: 'ClassCard' });
const term = z
  .object({ id: z.string(), semester: z.number().int(), yearOfStudy: z.number().int(), startedAt: z.string(), endedAt: z.string().nullable() })
  .meta({ id: 'Term' });

const idParams = z.object({ id: z.string().min(1) });
const pct = z.number().int().min(1).max(100);
const section = z.string().trim().max(8);

const router = Router();

router.get(
  '/',
  auth(),
  route(registry, {
    method: 'get',
    path: '/classes',
    summary: 'My classes (student: home + extra; staff: class teacher or allotted); admin ?all=1 = every class',
    guard: 'auth',
    request: { query: pageQuery.extend({ all: z.enum(['0', '1']).optional() }) },
    responses: { 200: z.object({ items: z.array(classCard), nextCursor: z.string().nullable() }) },
  }),
  async (req, res) => {
    const { all, cursor, limit } = req.query as unknown as { all?: '0' | '1'; cursor?: string; limit: number };
    res.json(page(await listClasses(req.user!, all === '1', paginate(cursor, limit)), limit));
  },
);

router.post(
  '/',
  staff(),
  route(registry, {
    method: 'post',
    path: '/classes',
    summary: 'Create a class (batch) + its first term; the creator is the class teacher',
    guard: 'auth',
    request: {
      body: z.object({
        branchId: z.string().min(1),
        admissionYear: z.number().int().min(2000).max(2100),
        section: section.default(''),
        minAttendancePct: pct.default(75),
        /** Defaults to the semester `admissionYear` is in today. */
        semester: z.number().int().min(1).max(8).optional(),
      }),
    },
    responses: { 201: classCard, 404: null },
  }),
  async (req, res) => {
    const body = req.body as { branchId: string; admissionYear: number; section: string; minAttendancePct: number; semester?: number };
    const branch = await db.branch.findUnique({ where: { id: body.branchId } });
    if (!branch) throw new HttpError(404, 'NOT_FOUND', 'Branch not found');
    const semester = body.semester ?? semesterFor(body.admissionYear);
    const cls = await db.$transaction(async (tx) => {
      const cls = await tx.class.create({
        data: {
          institutionId: branch.institutionId,
          branchId: branch.id,
          admissionYear: body.admissionYear,
          section: body.section,
          minAttendancePct: body.minAttendancePct,
          name: className(branch.code, yearOf(semester), body.section),
          classTeacherId: req.user!.id,
          terms: { create: { semester, yearOfStudy: yearOf(semester) } },
        },
      });
      await audit(req.user!, { action: 'class.create', classId: cls.id, targetType: 'Class', targetId: cls.id, after: { name: cls.name, semester } }, tx);
      return cls;
    });
    res.status(201).json(await classSummary(cls.id, req.user!));
  },
);

router.get(
  '/:id',
  classAccess('id', 'read'),
  route(registry, { method: 'get', path: '/classes/:id', summary: 'One class', guard: 'classAccess', request: { params: idParams }, responses: { 200: classCard } }),
  async (req, res) => {
    res.json(await classSummary(String(req.params.id), req.user!));
  },
);

router.patch(
  '/:id',
  classAccess('id', 'own'),
  writable,
  route(registry, {
    method: 'patch',
    path: '/classes/:id',
    summary: 'Class settings: minimum attendance, section (renames the class)',
    guard: 'classAccess',
    request: { params: idParams, body: z.object({ minAttendancePct: pct.optional(), section: section.optional() }) },
    responses: { 200: classCard },
  }),
  async (req, res) => {
    const id = String(req.params.id);
    const body = req.body as { minAttendancePct?: number; section?: string };
    await db.$transaction(async (tx) => {
      const before = await tx.class.findUniqueOrThrow({ where: { id }, include: { branch: true } });
      const t = await tx.term.findFirstOrThrow({ where: { classId: id }, orderBy: { semester: 'desc' } });
      const after = await tx.class.update({
        where: { id },
        data: { ...body, name: className(before.branch.code, t.yearOfStudy, body.section ?? before.section) },
      });
      await audit(
        req.user!,
        {
          action: 'class.update',
          classId: id,
          targetType: 'Class',
          targetId: id,
          before: { name: before.name, section: before.section, minAttendancePct: before.minAttendancePct },
          after: { name: after.name, section: after.section, minAttendancePct: after.minAttendancePct },
        },
        tx,
      );
    });
    res.json(await classSummary(id, req.user!));
  },
);

router.get(
  '/:id/terms',
  classAccess('id', 'read'),
  route(registry, {
    method: 'get',
    path: '/classes/:id/terms',
    summary: 'All terms, newest first (past ones are read-only)',
    guard: 'classAccess',
    request: { params: idParams },
    responses: { 200: z.object({ items: z.array(term) }) },
  }),
  async (req, res) => {
    const items = await db.term.findMany({
      where: { classId: String(req.params.id) },
      orderBy: { semester: 'desc' },
      select: { id: true, semester: true, yearOfStudy: true, startedAt: true, endedAt: true },
    });
    res.json({ items });
  },
);

router.post(
  '/:id/terms/next',
  classAccess('id', 'own'),
  writable,
  route(registry, {
    method: 'post',
    path: '/classes/:id/terms/next',
    summary: 'Start next semester (D5): close the active term, open semester+1; the roster carries over',
    guard: 'classAccess',
    request: { params: idParams },
    responses: { 200: classCard, 409: null },
  }),
  async (req, res) => {
    const id = String(req.params.id);
    await db.$transaction(async (tx) => {
      const old = await activeTerm(id, tx);
      if (old.semester >= 8) throw new HttpError(409, 'GRADUATE_INSTEAD', 'Semester 8 is the last one: graduate the class instead');
      // Guarded update: a concurrent promotion finds 0 rows here instead of opening two terms.
      const closed = await tx.term.updateMany({ where: { id: old.id, endedAt: null }, data: { endedAt: new Date() } });
      if (closed.count === 0) throw new HttpError(409, 'NO_ACTIVE_TERM', 'This class has no active term');
      const semester = old.semester + 1;
      const next = await tx.term.create({ data: { classId: id, semester, yearOfStudy: yearOf(semester) } });
      const cls = await tx.class.findUniqueOrThrow({ where: { id }, include: { branch: true } });
      const name = className(cls.branch.code, next.yearOfStudy, cls.section);
      await tx.class.update({ where: { id }, data: { name } });
      const audience = await classAudience(id, tx);
      // Allotted teachers came with old-term subjects; the CR re-allots them for the new term (CS-03).
      await tx.classMember.deleteMany({ where: { classId: id, role: 'teacher' } });
      await audit(
        req.user!,
        { action: 'class.term.next', classId: id, targetType: 'Term', targetId: next.id, before: { termId: old.id, semester: old.semester, name: cls.name }, after: { semester, name } },
        tx,
      );
      await notify(audience, 'class-term', { text: `${name} started semester ${semester}`, classId: id, termId: next.id }, tx);
    });
    res.json(await classSummary(id, req.user!));
  },
);

router.post(
  '/:id/graduate',
  classAccess('id', 'own'),
  writable,
  route(registry, {
    method: 'post',
    path: '/classes/:id/graduate',
    summary: 'Graduate (after semester 8, or any time by an admin): close the term and archive the class',
    guard: 'classAccess',
    request: { params: idParams },
    responses: { 200: classCard, 409: null },
  }),
  async (req, res) => {
    const id = String(req.params.id);
    await db.$transaction(async (tx) => {
      const cls = await tx.class.findUniqueOrThrow({ where: { id } });
      if (cls.archivedAt) throw new HttpError(409, 'ARCHIVED', 'This class has already graduated');
      const t = await tx.term.findFirst({ where: { classId: id, endedAt: null } });
      if (!req.user!.isAdmin && (t?.semester ?? 0) < 8) throw new HttpError(409, 'NOT_FINAL_SEMESTER', 'A class graduates after semester 8');
      const now = new Date();
      if (t) await tx.term.update({ where: { id: t.id }, data: { endedAt: now } });
      await tx.class.update({ where: { id }, data: { archivedAt: now } });
      await audit(req.user!, { action: 'class.graduate', classId: id, targetType: 'Class', targetId: id, after: { archivedAt: now.toISOString(), semester: t?.semester ?? null } }, tx);
      await notify(await classAudience(id, tx), 'class-term', { text: `${cls.name} has graduated`, classId: id }, tx);
    });
    res.json(await classSummary(id, req.user!));
  },
);

router.post(
  '/:id/handover',
  classAccess('id', 'own'),
  writable,
  route(registry, {
    method: 'post',
    path: '/classes/:id/handover',
    summary: 'Hand the class to another staff member (they become the class teacher); both are notified',
    guard: 'classAccess',
    request: { params: idParams, body: z.object({ teacherId: z.string().min(1) }) },
    responses: { 200: classCard },
  }),
  async (req, res) => {
    const id = String(req.params.id);
    const { teacherId } = req.body as { teacherId: string };
    const to = await db.user.findUnique({ where: { id: teacherId }, select: { id: true, name: true, role: true, status: true } });
    if (to?.role !== 'staff' || to.status !== 'active') throw new HttpError(422, 'VALIDATION', 'The new class teacher must be an active staff member');
    await db.$transaction(async (tx) => {
      const cls = await tx.class.findUniqueOrThrow({ where: { id }, include: { classTeacher: { select: { id: true, name: true } } } });
      if (cls.classTeacherId === to.id) throw new HttpError(422, 'VALIDATION', `${to.name} is already the class teacher`);
      await tx.class.update({ where: { id }, data: { classTeacherId: to.id } });
      await audit(req.user!, { action: 'class.handover', classId: id, targetType: 'Class', targetId: id, before: cls.classTeacher, after: { id: to.id, name: to.name } }, tx);
      await notify([to.id], 'class-handover', { text: `You are now the class teacher of ${cls.name}`, classId: id }, tx);
      await notify([cls.classTeacherId], 'class-handover', { text: `${cls.name} was handed over to ${to.name}`, classId: id }, tx);
    });
    res.json(await classSummary(id, req.user!));
  },
);

// Sub-routers under /classes/:id (CS-02…CS-07): `Router({ mergeParams: true })`, guard each route with
// `classAccess('id', …)` and put `writable` (./service.ts) on every write. Add one import + one line here:
// router.use('/:id', members);
router.use(notImplemented); // unbuilt sub-paths 501 until their task lands
export default router;
