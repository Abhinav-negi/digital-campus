import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../../lib/audit.js';
import type { AuthUser } from '../../lib/auth.js';
import { classAccess } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { notify } from '../../lib/notify.js';
import { registry, route } from '../../lib/openapi.js';
import { activeTerm, writable } from './service.js';

// CS-03: subjects with teacher allotment (D7). Mounted at /classes/:id.

const idParams = z.object({ id: z.string().min(1) });
const sidParams = idParams.extend({ sid: z.string().min(1) });
const subject = z
  .object({ id: z.string(), termId: z.string(), name: z.string(), code: z.string().nullable(), teacher: z.object({ id: z.string(), name: z.string() }).nullable() })
  .meta({ id: 'Subject' });
const select = { id: true, termId: true, name: true, code: true, teacher: { select: { id: true, name: true } } } satisfies Prisma.SubjectSelect;
const name = z.string().trim().min(1).max(100);
const code = z.string().trim().max(20);

const assertTeacher = async (id: string) => {
  const u = await db.user.findUnique({ where: { id }, select: { role: true, status: true } });
  if (u?.role !== 'staff' || u.status !== 'active') throw new HttpError(422, 'VALIDATION', 'The teacher must be an active staff member');
};

/** Drop an allotted teacher's membership once they teach nothing in the class's active term. */
const dropIfIdle = async (tx: Prisma.TransactionClient, classId: string, userId: string) => {
  if (await tx.subject.count({ where: { classId, teacherId: userId, term: { endedAt: null } } })) return;
  await tx.classMember.deleteMany({ where: { classId, userId, role: 'teacher' } });
};

/**
 * Subject `subjectId` (already saved with its new `teacherId`) went from teacher `from` to `to`: the new teacher joins the
 * class and is told (with "Not me"), the old one leaves if it was their last subject here. Reuse from CS-06 apply.
 */
export const allot = async (tx: Prisma.TransactionClient, subjectId: string, from: string | null, to: string | null, by: AuthUser) => {
  if (from === to) return;
  const s = await tx.subject.findUniqueOrThrow({ where: { id: subjectId }, select: { name: true, classId: true, class: { select: { name: true } } } });
  if (to) {
    await tx.classMember.upsert({ where: { classId_userId: { classId: s.classId, userId: to } }, create: { classId: s.classId, userId: to, role: 'teacher' }, update: {} });
    if (to !== by.id)
      await notify([to], 'subject-allotted', { text: `${by.name} added you as the ${s.name} teacher of ${s.class.name}`, classId: s.classId, subjectId, by: by.id }, tx);
  }
  if (from) await dropIfIdle(tx, s.classId, from);
};

/** The subject in this class, or 404; a past term's subject is read-only → 409. */
const editable = async (tx: Prisma.TransactionClient, classId: string, sid: string) => {
  const s = await tx.subject.findFirst({ where: { id: sid, classId }, include: { term: { select: { endedAt: true } } } });
  if (!s) throw new HttpError(404, 'NOT_FOUND', 'Subject not found');
  if (s.term.endedAt) throw new HttpError(409, 'PAST_TERM', 'Subjects of a past term are read-only');
  return s;
};

const snapshot = (s: { name: string; code: string | null; teacherId: string | null }) => ({ name: s.name, code: s.code, teacherId: s.teacherId });

const router = Router({ mergeParams: true });

router.get(
  '/subjects',
  classAccess('id', 'read'),
  route(registry, {
    method: 'get',
    path: '/classes/:id/subjects',
    summary: "A term's subjects with their teachers (default: the latest term)",
    guard: 'classAccess',
    request: { params: idParams, query: z.object({ termId: z.string().min(1).optional() }) },
    responses: { 200: z.object({ items: z.array(subject) }) },
  }),
  async (req, res) => {
    const classId = String(req.params.id);
    const termId = (req.query as { termId?: string }).termId ?? (await db.term.findFirst({ where: { classId }, orderBy: { semester: 'desc' } }))?.id;
    res.json({ items: await db.subject.findMany({ where: { classId, termId }, select, orderBy: [{ name: 'asc' }, { id: 'asc' }] }) });
  },
);

router.post(
  '/subjects',
  classAccess('id', 'board'),
  writable,
  route(registry, {
    method: 'post',
    path: '/classes/:id/subjects',
    summary: 'Add a subject to the active term and allot its teacher (they are notified, with "Not me")',
    guard: 'classAccess',
    request: { params: idParams, body: z.object({ name, code: code.optional(), teacherId: z.string().min(1) }) },
    responses: { 201: subject, 409: null },
  }),
  async (req, res) => {
    const classId = String(req.params.id);
    const body = req.body as { name: string; code?: string; teacherId: string };
    await assertTeacher(body.teacherId);
    const created = await db.$transaction(async (tx) => {
      const term = await activeTerm(classId, tx);
      const s = await tx.subject.create({ data: { classId, termId: term.id, name: body.name, code: body.code || null, teacherId: body.teacherId, assignedById: req.user!.id }, select });
      await allot(tx, s.id, null, body.teacherId, req.user!);
      await audit(req.user!, { action: 'subject.create', classId, targetType: 'Subject', targetId: s.id, after: { name: s.name, code: s.code, teacherId: body.teacherId } }, tx);
      return s;
    });
    res.status(201).json(created);
  },
);

router.patch(
  '/subjects/:sid',
  classAccess('id', 'board'),
  writable,
  route(registry, {
    method: 'patch',
    path: '/classes/:id/subjects/:sid',
    summary: 'Edit a subject; a new teacherId re-allots (null = no teacher yet)',
    guard: 'classAccess',
    request: { params: sidParams, body: z.object({ name: name.optional(), code: code.nullable().optional(), teacherId: z.string().min(1).nullable().optional() }) },
    responses: { 200: subject, 404: null, 409: null },
  }),
  async (req, res) => {
    const { id: classId, sid } = req.params as { id: string; sid: string };
    const body = req.body as { name?: string; code?: string | null; teacherId?: string | null };
    if (body.teacherId) await assertTeacher(body.teacherId);
    const updated = await db.$transaction(async (tx) => {
      const before = await editable(tx, classId, sid);
      const after = await tx.subject.update({
        where: { id: sid },
        data: { name: body.name, code: body.code === undefined ? undefined : body.code || null, ...(body.teacherId !== undefined && { teacherId: body.teacherId, assignedById: req.user!.id }) },
      });
      await allot(tx, sid, before.teacherId, after.teacherId, req.user!);
      await audit(req.user!, { action: 'subject.update', classId, targetType: 'Subject', targetId: sid, before: snapshot(before), after: snapshot(after) }, tx);
      return tx.subject.findUniqueOrThrow({ where: { id: sid }, select });
    });
    res.json(updated);
  },
);

router.delete(
  '/subjects/:sid',
  classAccess('id', 'board'),
  writable,
  route(registry, {
    method: 'delete',
    path: '/classes/:id/subjects/:sid',
    summary: 'Delete a subject (with its timetable slots); one with attendance taken → 409',
    guard: 'classAccess',
    request: { params: sidParams },
    responses: { 204: null, 404: null, 409: null },
  }),
  async (req, res) => {
    const { id: classId, sid } = req.params as { id: string; sid: string };
    await db.$transaction(async (tx) => {
      const s = await editable(tx, classId, sid);
      if (await tx.attendanceSession.count({ where: { subjectId: sid } }))
        throw new HttpError(409, 'HAS_ATTENDANCE', 'Attendance has been taken for this subject, so it cannot be deleted');
      await tx.subject.delete({ where: { id: sid } });
      if (s.teacherId) await dropIfIdle(tx, classId, s.teacherId);
      await audit(req.user!, { action: 'subject.delete', classId, targetType: 'Subject', targetId: sid, before: snapshot(s) }, tx);
    });
    res.status(204).end();
  },
);

router.post(
  '/subjects/:sid/decline',
  classAccess('id', 'read'),
  writable,
  route(registry, {
    method: 'post',
    path: '/classes/:id/subjects/:sid/decline',
    summary: '"Not me": the allotted teacher unassigns themselves; the CR(s) and the class teacher are told',
    guard: 'classAccess',
    request: { params: sidParams },
    responses: { 204: null, 403: null, 404: null, 409: null },
  }),
  async (req, res) => {
    const { id: classId, sid } = req.params as { id: string; sid: string };
    const me = req.user!;
    await db.$transaction(async (tx) => {
      const s = await editable(tx, classId, sid);
      if (s.teacherId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the allotted teacher can decline this subject');
      // Guarded update: a concurrent re-allot matches 0 rows instead of being undone.
      const done = await tx.subject.updateMany({ where: { id: sid, teacherId: me.id }, data: { teacherId: null } });
      if (done.count !== 1) throw new HttpError(409, 'CHANGED', 'This subject was just changed');
      await dropIfIdle(tx, classId, me.id);
      const cls = await tx.class.findUniqueOrThrow({ where: { id: classId }, select: { name: true, classTeacherId: true, members: { where: { role: 'cr' }, select: { userId: true } } } });
      await audit(me, { action: 'subject.decline', classId, targetType: 'Subject', targetId: sid, before: { teacherId: me.id }, after: { teacherId: null } }, tx);
      await notify(
        [cls.classTeacherId, ...cls.members.map((m) => m.userId)],
        'subject-declined',
        { text: `${me.name} isn't teaching ${s.name} in ${cls.name}: pick another teacher`, classId, subjectId: sid, by: me.id },
        tx,
      );
    });
    res.status(204).end();
  },
);

export default router;
