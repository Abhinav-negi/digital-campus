import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../../lib/audit.js';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { notify } from '../../lib/notify.js';
import { registry, route } from '../../lib/openapi.js';
import { createInvite } from '../invites/service.js';
import { institutionOf } from './school.js';
import { isDeleted } from './users.js';

// AD-03 (D2, D4): edit a student's details, move them to another batch. Mounted under /admin, behind admin().

const adminStudent = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    studentIdNo: z.string().nullable(),
    status: z.enum(['invited', 'active', 'disabled']),
    homeClass: z.object({ id: z.string(), name: z.string() }).nullable(),
  })
  .meta({ id: 'AdminStudent' });

const idParams = z.object({ id: z.string().min(1) });
const select = { id: true, name: true, email: true, studentIdNo: true, status: true, homeClass: { select: { id: true, name: true } } } as const;
const toStudent = (id: string) => db.user.findUniqueOrThrow({ where: { id }, select });

/** A live (not SPEC §12-deleted) student of the admin's institution, or 404. */
const findStudent = async (id: string, adminId: string) => {
  const s = await db.user.findUnique({ where: { id }, select: { ...select, role: true, institutionId: true, homeClassId: true } });
  if (!s || s.role !== 'student' || isDeleted(s) || s.institutionId !== (await institutionOf(adminId)))
    throw new HttpError(404, 'NOT_FOUND', 'Student not found');
  return s;
};

const router = Router();

const detailsBody = z
  .object({
    name: z.string().trim().min(1).max(120),
    studentIdNo: z.string().trim().min(1).max(40),
    email: z.email().toLowerCase(),
  })
  .partial();

router.patch(
  '/students/:id',
  route(registry, {
    method: 'patch',
    path: '/admin/students/:id',
    summary: "Edit a student's name, student ID or email; a new email on an invited account re-sends the invite",
    guard: 'admin',
    request: { params: idParams, body: detailsBody },
    responses: { 200: adminStudent, 404: null, 409: null },
  }),
  async (req, res) => {
    const s = await findStudent(req.params.id as string, req.user!.id);
    const body = req.body as z.infer<typeof detailsBody>;
    const keys = (['name', 'studentIdNo', 'email'] as const).filter((k) => body[k] !== undefined && body[k] !== s[k]);
    if (keys.length) {
      const before = Object.fromEntries(keys.map((k) => [k, s[k]]));
      const after = Object.fromEntries(keys.map((k) => [k, body[k]!]));
      await db.$transaction(async (tx) => {
        await tx.user.update({ where: { id: s.id }, data: after }); // a taken email → P2002 → 409
        // The old link would point at an email that no longer exists.
        if (after.email) await tx.invite.deleteMany({ where: { email: s.email, acceptedAt: null } });
        await audit(req.user!, { action: 'student.update', classId: s.homeClassId ?? undefined, targetType: 'User', targetId: s.id, before, after }, tx);
        await notify([s.id], 'account-update', { text: `An admin updated your ${keys.map((k) => ({ name: 'name', studentIdNo: 'student ID', email: 'email' })[k]).join(', ')}` }, tx);
      });
      // After the commit: createInvite sends mail (FND-05).
      if (after.email && s.status === 'invited')
        await createInvite({ email: after.email, role: 'student', classId: s.homeClassId ?? undefined, invitedById: req.user!.id });
    }
    res.json(await toStudent(s.id));
  },
);

const moveBody = z.object({ classId: z.string().min(1) });

router.post(
  '/students/:id/move',
  route(registry, {
    method: 'post',
    path: '/admin/students/:id/move',
    summary: 'Move a student to another batch (D4): new home class + membership; attendance history stays; a CR role on the old class is dropped',
    guard: 'admin',
    request: { params: idParams, body: moveBody },
    responses: { 200: adminStudent, 404: null, 409: null },
  }),
  async (req, res) => {
    const s = await findStudent(req.params.id as string, req.user!.id);
    const { classId } = req.body as z.infer<typeof moveBody>;
    const to = await db.class.findUnique({ where: { id: classId }, select: { id: true, name: true, institutionId: true, archivedAt: true } });
    if (!to || to.institutionId !== (await institutionOf(req.user!.id))) throw new HttpError(404, 'NOT_FOUND', 'Class not found');
    if (to.archivedAt) throw new HttpError(409, 'ARCHIVED', 'That class is archived');
    if (to.id === s.homeClassId) throw new HttpError(409, 'SAME_CLASS', 'The student is already in that class');
    await db.$transaction(async (tx) => {
      const old = s.homeClassId && (await tx.classMember.findUnique({ where: { classId_userId: { classId: s.homeClassId, userId: s.id } }, select: { role: true } }));
      // Attendance rows hang off the old class's sessions and stay put; only access moves.
      if (s.homeClassId) await tx.classMember.deleteMany({ where: { classId: s.homeClassId, userId: s.id } });
      await tx.classMember.upsert({
        where: { classId_userId: { classId: to.id, userId: s.id } },
        create: { classId: to.id, userId: s.id, role: 'student' },
        update: { role: 'student' },
      });
      await tx.user.update({ where: { id: s.id }, data: { homeClassId: to.id } });
      await audit(
        req.user!,
        {
          action: 'student.move',
          classId: to.id,
          targetType: 'User',
          targetId: s.id,
          before: { classId: s.homeClassId, class: s.homeClass?.name ?? null, role: old ? old.role : null },
          after: { classId: to.id, class: to.name, role: 'student' },
        },
        tx,
      );
      await notify([s.id], 'class-move', { text: `An admin moved you to ${to.name}`, classId: to.id }, tx);
    });
    // The pending link (and its email) named the old class.
    if (s.status === 'invited') await createInvite({ email: s.email, role: 'student', classId: to.id, invitedById: req.user!.id });
    res.json(await toStudent(s.id));
  },
);

export default router;
