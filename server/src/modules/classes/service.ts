import type { Prisma } from '@prisma/client';
import type { RequestHandler } from 'express';
import type { AuthUser } from '../../lib/auth.js';
import { today } from '../../lib/dates.js';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';

const ORD = ['', '1st', '2nd', '3rd', '4th'];

/** `CSE · 2nd year · A` (PROTO teacher.html ncName); recomputed on promotion and section change. */
export const className = (branchCode: string, yearOfStudy: number, section: string) =>
  `${branchCode} · ${ORD[yearOfStudy] ?? `${yearOfStudy}th`} year${section ? ` · ${section}` : ''}`;

export const yearOf = (semester: number) => Math.ceil(semester / 2);

/** Semester a batch admitted in `admissionYear` is in on `on`, clamped to 1..8. */
// ponytail: academic year assumed to start in July; make it an Institution setting if a college differs.
export const semesterFor = (admissionYear: number, on = today()) =>
  Math.min(8, Math.max(1, (on.getUTCFullYear() - admissionYear) * 2 + (on.getUTCMonth() >= 6 ? 1 : 0)));

/**
 * "An archived class is read-only for everyone except the admin." Mount after `classAccess('id', …)` on every
 * class write (sub-routers use `Router({ mergeParams: true })`, so `req.params.id` is the class id) → 409 ARCHIVED.
 */
export const writable: RequestHandler = async (req, _res, next) => {
  if (!req.user?.isAdmin) {
    const cls = await db.class.findUnique({ where: { id: String(req.params.id) }, select: { archivedAt: true } });
    if (cls?.archivedAt) throw new HttpError(409, 'ARCHIVED', 'This class is archived and read-only');
  }
  next();
};

/** The active term or 409; pass `tx` inside a transaction. */
export const activeTerm = async (classId: string, tx: Prisma.TransactionClient = db) => {
  const term = await tx.term.findFirst({ where: { classId, endedAt: null } });
  if (!term) throw new HttpError(409, 'NO_ACTIVE_TERM', 'This class has no active term');
  return term;
};

/** Everyone to tell about a class-wide change: members + the class teacher. */
export const classAudience = async (classId: string, tx: Prisma.TransactionClient = db) => {
  const cls = await tx.class.findUniqueOrThrow({ where: { id: classId }, select: { classTeacherId: true, members: { select: { userId: true } } } });
  return [cls.classTeacherId, ...cls.members.map((m) => m.userId)];
};

// --- the class card (GET /classes, GET /classes/:id, every write's response) ---
const summarySelect = (userId: string) =>
  ({
    id: true,
    name: true,
    admissionYear: true,
    section: true,
    minAttendancePct: true,
    archivedAt: true,
    branch: { select: { id: true, code: true, name: true } },
    classTeacher: { select: { id: true, name: true } },
    // Latest term = the active one, or the last one of a graduated class.
    terms: { orderBy: { semester: 'desc' }, take: 1, select: { id: true, semester: true, yearOfStudy: true, endedAt: true, _count: { select: { subjects: true } } } },
    members: { where: { OR: [{ role: 'cr' }, { userId }] }, select: { role: true, user: { select: { id: true, name: true } } } },
    _count: { select: { members: { where: { role: { in: ['student', 'cr'] } } } } },
  }) satisfies Prisma.ClassSelect;

type Row = Prisma.ClassGetPayload<{ select: ReturnType<typeof summarySelect> }>;

const toSummary = (c: Row, userId: string) => {
  const term = c.terms[0]!; // a class is always created with Term 1
  return {
    id: c.id,
    name: c.name,
    branch: c.branch,
    admissionYear: c.admissionYear,
    section: c.section,
    minAttendancePct: c.minAttendancePct,
    archivedAt: c.archivedAt,
    classTeacher: c.classTeacher,
    termId: term.id,
    semester: term.semester,
    yearOfStudy: term.yearOfStudy,
    termLabel: `Semester ${term.semester}`,
    counts: { students: c._count.members, subjects: term._count.subjects },
    crs: c.members.filter((m) => m.role === 'cr').map((m) => m.user),
    myRole: c.classTeacher.id === userId ? ('classTeacher' as const) : (c.members.find((m) => m.user.id === userId)?.role ?? null),
  };
};

export const classSummary = async (id: string, user: AuthUser) =>
  toSummary(await db.class.findUniqueOrThrow({ where: { id }, select: summarySelect(user.id) }), user.id);

/** Mine = class teacher or any ClassMember (student, CR, allotted teacher). Admin `all` = every class. */
export const listClasses = async (user: AuthUser, all: boolean, args: { take: number; cursor?: { id: string }; skip?: number }) => {
  const where: Prisma.ClassWhereInput = all && user.isAdmin ? {} : { OR: [{ classTeacherId: user.id }, { members: { some: { userId: user.id } } }] };
  const rows = await db.class.findMany({ where, select: summarySelect(user.id), orderBy: [{ name: 'asc' }, { id: 'asc' }], ...args });
  return rows.map((c) => toSummary(c, user.id));
};
