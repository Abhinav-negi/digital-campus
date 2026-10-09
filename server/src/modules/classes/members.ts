import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../../lib/audit.js';
import { classAccess, perUser } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { notify } from '../../lib/notify.js';
import { registry, route } from '../../lib/openapi.js';
import { createInvite } from '../invites/service.js';
import { writable } from './service.js';

// CS-02: roster, student invites (SPEC §6, ARCH §9.1), CR. Mounted at /classes/:id.

const idParams = z.object({ id: z.string().min(1) });
const memberParams = idParams.extend({ userId: z.string().min(1) });
const member = z
  .object({
    id: z.string(),
    name: z.string(),
    isCR: z.boolean(),
    /** Staff and admin only (ARCH §3 "Roster with emails"). */
    studentIdNo: z.string().nullable().optional(),
    email: z.string().optional(),
    status: z.enum(['invited', 'active', 'disabled']).optional(),
  })
  .meta({ id: 'ClassMember' });
const rosterBody = z.object({ items: z.array(member) });
const previewRow = z.object({ studentIdNo: z.string(), email: z.string(), issue: z.enum(['Duplicate', 'Bad email']).nullable() });
const previewBody = z.object({ rows: z.array(previewRow), ready: z.number().int(), dup: z.number().int(), bad: z.number().int() }).meta({ id: 'InvitePreview' });
type PreviewRow = z.infer<typeof previewRow>;

const roster = async (classId: string, withContact: boolean) => {
  const rows = await db.classMember.findMany({
    where: { classId, role: { in: ['student', 'cr'] } },
    select: { role: true, user: { select: { id: true, name: true, studentIdNo: true, email: true, status: true } } },
    orderBy: [{ user: { studentIdNo: 'asc' } }, { user: { name: 'asc' } }],
  });
  return rows.map(({ role, user: { id, name, ...contact } }) => ({ id, name, isCR: role === 'cr', ...(withContact && contact) }));
};

// PROTO teacher.html parseList: header rows skipped; bad email first, then duplicates within the paste and against every user.
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const HEADER = /^(student)?id$/i;

const preview = async (input: { studentIdNo: string; email: string }[]) => {
  const rows = input.filter((r) => !HEADER.test(r.studentIdNo)).map((r) => ({ studentIdNo: r.studentIdNo, email: r.email.toLowerCase() }));
  const taken = await db.user.findMany({
    where: { OR: [{ email: { in: rows.map((r) => r.email) } }, { studentIdNo: { in: rows.map((r) => r.studentIdNo), mode: 'insensitive' } }] },
    select: { email: true, studentIdNo: true },
  });
  const ids = new Set(taken.map((u) => u.studentIdNo?.toLowerCase()));
  const mails = new Set(taken.map((u) => u.email));
  return rows.map((r): PreviewRow => {
    const id = r.studentIdNo.toLowerCase();
    const issue = !EMAIL.test(r.email) ? 'Bad email' : ids.has(id) || mails.has(r.email) ? 'Duplicate' : null;
    if (!issue) {
      ids.add(id);
      mails.add(r.email);
    }
    return { ...r, issue };
  });
};

const counts = (rows: PreviewRow[]) => ({
  rows,
  ready: rows.filter((r) => !r.issue).length,
  dup: rows.filter((r) => r.issue === 'Duplicate').length,
  bad: rows.filter((r) => r.issue === 'Bad email').length,
});

const router = Router({ mergeParams: true });

router.get(
  '/members',
  classAccess('id', 'read'),
  route(registry, {
    method: 'get',
    path: '/classes/:id/members',
    summary: 'The roster (students + CRs); studentIdNo, email and status for staff and admin only',
    guard: 'classAccess',
    request: { params: idParams },
    responses: { 200: rosterBody },
  }),
  async (req, res) => {
    const u = req.user!;
    res.json({ items: await roster(String(req.params.id), u.role === 'staff' || u.isAdmin) });
  },
);

router.post(
  '/invites',
  classAccess('id', 'own'),
  writable,
  route(registry, {
    method: 'post',
    path: '/classes/:id/invites',
    summary: 'Invite students from pasted `ID, email` rows; dryRun → the preview only, else create invited accounts and email them',
    guard: 'classAccess',
    request: {
      params: idParams,
      body: z.object({
        rows: z.array(z.object({ studentIdNo: z.string().trim().min(1).max(40), email: z.string().trim().max(254).default('') })).min(1).max(500),
        dryRun: z.boolean().default(true),
      }),
    },
    responses: { 200: previewBody, 201: previewBody },
  }),
  async (req, res) => {
    const id = String(req.params.id);
    const body = req.body as { rows: { studentIdNo: string; email: string }[]; dryRun: boolean };
    const rows = await preview(body.rows);
    if (body.dryRun) {
      res.json(counts(rows));
      return;
    }

    const ready = rows.filter((r) => !r.issue);
    const { institutionId } = await db.class.findUniqueOrThrow({ where: { id }, select: { institutionId: true } });
    const created = await db.$transaction(async (tx) => {
      const users = await tx.user.createManyAndReturn({
        data: ready.map((r) => ({ institutionId, role: 'student' as const, name: r.studentIdNo, email: r.email, studentIdNo: r.studentIdNo, homeClassId: id })),
        skipDuplicates: true,
        select: { id: true, email: true },
      });
      await tx.classMember.createMany({ data: users.map((u) => ({ classId: id, userId: u.id, role: 'student' as const })) });
      await tx.profile.createMany({ data: users.map((u) => ({ userId: u.id, skills: [] })) });
      await audit(req.user!, { action: 'class.invite', classId: id, targetType: 'Class', targetId: id, after: { emails: users.map((u) => u.email) } }, tx);
      return users;
    });
    // A row a concurrent paste took between the preview and the insert.
    const made = new Set(created.map((u) => u.email));
    for (const r of ready) if (!made.has(r.email)) r.issue = 'Duplicate';
    // After the commit: createInvite sends mail (FND-05).
    for (const u of created) await createInvite({ email: u.email, role: 'student', classId: id, invitedById: req.user!.id });
    res.status(201).json(counts(rows));
  },
);

router.post(
  '/invites/resend',
  perUser(20, 3_600_000),
  classAccess('id', 'own'),
  writable,
  route(registry, {
    method: 'post',
    path: '/classes/:id/invites/resend',
    summary: 'Resend a pending student invite (new link, 14 more days); an activated account → 409',
    guard: 'classAccess',
    request: { params: idParams, body: z.object({ userId: z.string().min(1) }) },
    responses: { 200: z.object({ id: z.string(), expiresAt: z.string() }), 404: null, 409: null },
  }),
  async (req, res) => {
    const id = String(req.params.id);
    const { userId } = req.body as { userId: string };
    const m = await db.classMember.findFirst({ where: { classId: id, userId, role: { in: ['student', 'cr'] } }, select: { user: { select: { email: true } } } });
    if (!m) throw new HttpError(404, 'NOT_FOUND', 'Student not found in this class');
    res.json(await createInvite({ email: m.user.email, role: 'student', classId: id, invitedById: req.user!.id }));
  },
);

router.put(
  '/cr',
  classAccess('id', 'own'),
  writable,
  route(registry, {
    method: 'put',
    path: '/classes/:id/cr',
    summary: 'Set the CR(s): 1–2 active or invited students of this class; the old and new CRs are notified',
    guard: 'classAccess',
    request: { params: idParams, body: z.object({ userIds: z.array(z.string().min(1)).min(1).max(2) }) },
    responses: { 200: rosterBody },
  }),
  async (req, res) => {
    const id = String(req.params.id);
    const ids = [...new Set((req.body as { userIds: string[] }).userIds)];
    await db.$transaction(async (tx) => {
      const cls = await tx.class.findUniqueOrThrow({
        where: { id },
        select: { name: true, members: { where: { role: { in: ['student', 'cr'] } }, select: { userId: true, role: true, user: { select: { status: true } } } } },
      });
      const ok = cls.members.filter((m) => ids.includes(m.userId) && m.user.status !== 'disabled'); // D17: an invited student may be CR (picked in the new-class wizard)
      if (ok.length !== ids.length) throw new HttpError(422, 'VALIDATION', 'A CR must be a student of this class with an active or pending account');
      const old = cls.members.filter((m) => m.role === 'cr').map((m) => m.userId);
      await tx.classMember.updateMany({ where: { classId: id, role: 'cr', userId: { notIn: ids } }, data: { role: 'student' } });
      await tx.classMember.updateMany({ where: { classId: id, userId: { in: ids } }, data: { role: 'cr' } });
      await audit(req.user!, { action: 'class.cr', classId: id, targetType: 'Class', targetId: id, before: old, after: ids }, tx);
      await notify(ids.filter((u) => !old.includes(u)), 'class-cr', { text: `You are now the CR of ${cls.name}`, classId: id }, tx);
      await notify(old.filter((u) => !ids.includes(u)), 'class-cr', { text: `You are no longer the CR of ${cls.name}`, classId: id }, tx);
    });
    res.json({ items: await roster(id, true) });
  },
);

router.delete(
  '/members/:userId',
  classAccess('id', 'own'),
  writable,
  route(registry, {
    method: 'delete',
    path: '/classes/:id/members/:userId',
    summary: 'Remove a student from the class; they keep their account and Commons profile',
    guard: 'classAccess',
    request: { params: memberParams },
    responses: { 204: null, 404: null },
  }),
  async (req, res) => {
    const { id, userId } = req.params as { id: string; userId: string };
    await db.$transaction(async (tx) => {
      const m = await tx.classMember.findFirst({ where: { classId: id, userId, role: { in: ['student', 'cr'] } }, select: { id: true, role: true, user: { select: { email: true, status: true } } } });
      if (!m) throw new HttpError(404, 'NOT_FOUND', 'Student not found in this class');
      await tx.classMember.delete({ where: { id: m.id } });
      // A pending invite would otherwise still activate them (with no class).
      if (m.user.status === 'invited') await tx.invite.deleteMany({ where: { email: m.user.email, classId: id, acceptedAt: null } });
      await audit(req.user!, { action: 'class.member.remove', classId: id, targetType: 'User', targetId: userId, before: { role: m.role } }, tx);
    });
    res.status(204).end();
  },
);

export default router;
