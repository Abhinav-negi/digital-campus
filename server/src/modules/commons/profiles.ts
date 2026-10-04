import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { addDays, today } from '../../lib/dates.js';
import { db } from '../../lib/db.js';
import { HttpError, page, pageQuery } from '../../lib/http.js';
import { registry, route } from '../../lib/openapi.js';
import { blockedEitherWay, blockedIds } from './safety.js';

// CM-01: profiles, People, and the /me profile + export. Nothing here ever selects another user's email (SPEC §12).

type Avail = 'open' | 'questions' | 'focus';
const availability = z.enum(['open', 'questions', 'focus']);
const ORD = ['', '1st', '2nd', '3rd', '4th'];
const ORDER: Record<Avail, number> = { open: 0, questions: 1, focus: 2 };

// Handles only (the client prefixes github.com/ etc.); `other` must be http(s), never javascript: or data: (stored XSS).
const handle = z.string().trim().max(100).regex(/^[\w.-]*$/, 'Use the username only, e.g. riya-patel').default('');
const links = z.object({
  github: handle,
  leetcode: handle,
  linkedin: handle,
  other: z.array(z.url({ protocol: /^https?$/ }).trim().max(200)).max(5).default([]),
});
const emptyLinks = { github: '', leetcode: '', linkedin: '', other: [] };

export const personCard = z
  .object({
    id: z.string(),
    name: z.string(),
    branch: z.object({ id: z.string(), code: z.string() }).nullable(),
    year: z.number().int().nullable(),
    /** "CSE · 2nd year" */
    label: z.string().nullable(),
    otherBranch: z.boolean(),
    /** Effective: Focus past its date reads as open (ARCH §7). */
    availability,
    /** YYYY-MM-DD, only while in Focus. */
    focusUntil: z.string().nullable(),
    headline: z.string(),
    skills: z.array(z.string()),
    helpsJuniors: z.boolean(),
  })
  .meta({ id: 'PersonCard' });

const conversationState = z.enum(['requested', 'accepted', 'ignored']);
const personProfile = personCard
  .extend({
    links,
    track: z.object({ helped: z.number().int(), gigsDone: z.number().int(), projectsShipped: z.number().int() }),
    projects: z.array(z.object({ id: z.string(), title: z.string(), status: z.enum(['looking', 'building', 'shipped']) })),
    self: z.boolean(),
    canAsk: z.boolean(),
    conversation: z.object({ id: z.string(), state: conversationState, fromMe: z.boolean() }).nullable(),
  })
  .meta({ id: 'PersonProfile' });

// --- shared reads ---
export const personSelect = {
  id: true,
  name: true,
  profile: true,
  homeClass: { select: { branch: { select: { id: true, code: true } }, terms: { where: { endedAt: null }, select: { yearOfStudy: true }, take: 1 } } },
} satisfies Prisma.UserSelect;
type PersonRow = Prisma.UserGetPayload<{ select: typeof personSelect }>;
type ProfileRow = NonNullable<PersonRow['profile']>;

export const effective = (p: Pick<ProfileRow, 'availability' | 'focusUntil'>, on = today()): Avail =>
  p.availability === 'focus' && p.focusUntil && p.focusUntil < on ? 'open' : p.availability;

export const toCard = (u: PersonRow, myBranchId: string | null, on = today()): z.infer<typeof personCard> => {
  const branch = u.homeClass?.branch ?? null;
  const year = u.homeClass?.terms[0]?.yearOfStudy ?? null;
  const p = u.profile ?? { availability: 'open' as const, focusUntil: null, headline: '', skills: [], helpsJuniors: false };
  const avail = effective(p, on);
  return {
    id: u.id,
    name: u.name,
    branch,
    year,
    label: branch && (year ? `${branch.code} · ${ORD[year] ?? `${year}th`} year` : branch.code),
    otherBranch: !!myBranchId && !!branch && branch.id !== myBranchId,
    availability: avail,
    focusUntil: avail === 'focus' && p.focusUntil ? p.focusUntil.toISOString().slice(0, 10) : null,
    headline: p.headline,
    skills: p.skills,
    helpsJuniors: p.helpsJuniors,
  };
};

/** The viewer's institution and branch (for scoping and the other-branch flag). */
export const viewerOf = (id: string) =>
  db.user.findUniqueOrThrow({ where: { id }, select: { institutionId: true, homeClass: { select: { branchId: true } } } });

/** The sender of an ignored request is never told (SPEC §9.7): it reads as still requested. */
const visibleState = (c: { fromId: string; state: z.infer<typeof conversationState> }, me: string) =>
  c.fromId === me && c.state === 'ignored' ? 'requested' : c.state;

/** The full profile of `userId` as `meId` sees it; 404 unless an active, unbanned student. */
const profileView = async (meId: string, userId: string): Promise<z.infer<typeof personProfile>> => {
  const [viewer, u, helped, gigsDone, projects, convo] = await Promise.all([
    viewerOf(meId),
    db.user.findFirst({ where: { id: userId, role: 'student', status: 'active', bannedAt: null }, select: { ...personSelect, institutionId: true } }),
    db.thanks.count({ where: { toId: userId } }),
    db.boardPost.count({ where: { kind: 'gig', status: 'done', assigneeId: userId } }),
    db.project.findMany({
      where: { hiddenAt: null, members: { some: { userId } } },
      select: { id: true, title: true, status: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.conversation.findFirst({
      where: { OR: [{ fromId: meId, toId: userId }, { fromId: userId, toId: meId }] },
      select: { id: true, fromId: true, state: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  if (!u || u.institutionId !== viewer.institutionId || (await blockedEitherWay(meId, userId))) throw new HttpError(404, 'NOT_FOUND', 'Profile not found');
  const card = toCard(u, viewer.homeClass?.branchId ?? null);
  const self = meId === userId;
  return {
    ...card,
    links: links.safeParse(u.profile?.links).data ?? emptyLinks,
    track: { helped, gigsDone, projectsShipped: projects.filter((p) => p.status === 'shipped').length },
    projects,
    self,
    canAsk: !self && card.availability !== 'focus' && !convo,
    conversation: convo && { id: convo.id, state: visibleState(convo, meId), fromMe: convo.fromId === meId },
  };
};

// --- /commons ---
const router = Router();

const peopleQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  branchId: z.string().min(1).optional(),
  year: z.coerce.number().int().min(1).max(8).optional(),
  availability: availability.optional(),
  helpsJuniors: z.enum(['true', 'false']).optional(),
});

router.get(
  '/people',
  route(registry, {
    method: 'get',
    path: '/commons/people',
    summary: 'People: Open first, branches round-robined inside each availability group; q matches name, skill or headline',
    guard: 'commons',
    request: { query: peopleQuery },
    responses: { 200: z.object({ items: z.array(personCard), nextCursor: z.string().nullable() }) },
  }),
  async (req, res) => {
    const { q, branchId, year, availability: avail, helpsJuniors, cursor, limit } = req.query as unknown as z.infer<typeof peopleQuery>;
    const me = req.user!.id;
    const viewer = await viewerOf(me);
    const blocked = await blockedIds(me);
    // ponytail: effective availability, skill substrings and the round-robin need the whole filtered set, so we load it
    // and order in memory. Ceiling: one school's students (~thousands of small rows). Past that, persist a sort key.
    const rows = await db.user.findMany({
      where: {
        institutionId: viewer.institutionId,
        role: 'student',
        status: 'active',
        bannedAt: null,
        id: { not: me, notIn: blocked },
        profile: helpsJuniors === 'true' ? { is: { helpsJuniors: true } } : { isNot: null },
        ...((branchId || year) && {
          homeClass: { is: { branchId, ...(year && { terms: { some: { endedAt: null, yearOfStudy: year } } }) } },
        }),
      },
      select: personSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const on = today();
    const needle = q?.toLowerCase();
    const cards = rows
      .map((u) => toCard(u, viewer.homeClass?.branchId ?? null, on))
      .filter((c) => !avail || c.availability === avail)
      .filter(
        (c) =>
          !needle ||
          c.name.toLowerCase().includes(needle) ||
          c.headline.toLowerCase().includes(needle) ||
          c.skills.some((s) => s.toLowerCase().includes(needle)),
      );
    // PROTO student.html:443-446: the n-th person of a branch in a group gets rank n; sort by group, rank, branch code.
    const seen = new Map<string, number>();
    const rank = new Map(cards.map((c) => {
      const k = c.availability + (c.branch?.code ?? '');
      seen.set(k, (seen.get(k) ?? 0) + 1);
      return [c.id, seen.get(k)!];
    }));
    cards.sort(
      (a, b) =>
        ORDER[a.availability] - ORDER[b.availability] ||
        rank.get(a.id)! - rank.get(b.id)! ||
        (a.branch?.code ?? '').localeCompare(b.branch?.code ?? ''),
    );
    // Cursor = the last id of the previous page; an unknown cursor (that person left the list) restarts from the top.
    const start = cursor ? cards.findIndex((c) => c.id === cursor) + 1 : 0;
    res.json(page(cards.slice(start, start + limit + 1), limit));
  },
);

const userParams = z.object({ userId: z.string().min(1) });

router.get(
  '/profiles/:userId',
  route(registry, {
    method: 'get',
    path: '/commons/profiles/:userId',
    summary: "A student's profile: effective availability, track record, projects, canAsk and the conversation state with me",
    guard: 'commons',
    request: { params: userParams },
    responses: { 200: personProfile, 404: null },
  }),
  async (req, res) => {
    res.json(await profileView(req.user!.id, (req.params as z.infer<typeof userParams>).userId));
  },
);

export default router;

// --- /me (mounted by me/routes.ts behind auth()) ---
export const meProfileRouter = Router();

const profileBody = z
  .object({
    headline: z.string().trim().max(100),
    skills: z.array(z.string().trim().min(1).max(40)).max(10),
    links,
    availability,
    /** YYYY-MM-DD; only with availability "focus". Focus without a date → today + 7 days. */
    focusUntil: z.iso.date(),
    helpsJuniors: z.boolean(),
  })
  .partial()
  .refine((b) => !b.focusUntil || b.availability === 'focus', { message: 'focusUntil needs availability "focus"', path: ['focusUntil'] });

meProfileRouter.patch(
  '/profile',
  route(registry, {
    method: 'patch',
    path: '/me/profile',
    summary: 'Edit my Commons profile (students); every field optional, focus without a date lasts 7 days',
    guard: 'auth',
    request: { body: profileBody },
    responses: { 200: personProfile, 403: null },
  }),
  async (req, res) => {
    const me = req.user!;
    if (me.role !== 'student') throw new HttpError(403, 'FORBIDDEN', 'Only students have a Commons profile');
    const { focusUntil, skills, ...body } = req.body as z.infer<typeof profileBody>;
    const until = focusUntil ? new Date(focusUntil) : addDays(today(), 7);
    if (until < today()) throw new HttpError(422, 'VALIDATION', 'focusUntil is in the past');
    const data = {
      ...body,
      ...(skills && { skills: [...new Set(skills)] }),
      ...(body.availability && { focusUntil: body.availability === 'focus' ? until : null }),
    };
    await db.profile.upsert({ where: { userId: me.id }, update: data, create: { userId: me.id, ...data } });
    res.json(await profileView(me.id, me.id));
  },
);

meProfileRouter.get(
  '/export',
  route(registry, {
    method: 'get',
    path: '/me/export',
    summary: 'Download my data as JSON (SPEC §12): user, profile, classes, attendance, projects, posts, conversations, tickets, notifications',
    guard: 'auth',
    responses: { 200: z.record(z.string(), z.unknown()) },
  }),
  async (req, res) => {
    const id = req.user!.id;
    const who = { select: { id: true, name: true } }; // other people: never their email
    const [user, profile, classes, attendance, projects, boardPosts, classPosts, conversations, tickets, notifications] = await Promise.all([
      db.user.findUniqueOrThrow({
        where: { id },
        select: { id: true, name: true, email: true, role: true, isAdmin: true, studentIdNo: true, dept: true, homeClassId: true, createdAt: true },
      }),
      db.profile.findUnique({ where: { userId: id } }),
      db.classMember.findMany({ where: { userId: id }, select: { role: true, createdAt: true, class: { select: { id: true, name: true } } } }),
      db.attendance.findMany({
        where: { studentId: id },
        select: { present: true, source: true, flagged: true, createdAt: true, session: { select: { date: true, subject: { select: { name: true, code: true } } } } },
        orderBy: { createdAt: 'asc' },
      }),
      db.projectMember.findMany({
        where: { userId: id },
        select: { role: true, project: { select: { id: true, title: true, description: true, status: true, repoUrl: true, ownerId: true, createdAt: true } } },
      }),
      db.boardPost.findMany({ where: { authorId: id }, orderBy: { createdAt: 'asc' } }),
      db.post.findMany({ where: { authorId: id }, orderBy: { createdAt: 'asc' } }),
      db.conversation.findMany({
        where: { OR: [{ fromId: id }, { toId: id }] },
        select: {
          id: true,
          fromId: true,
          note: true,
          state: true,
          postId: true,
          createdAt: true,
          from: who,
          to: who,
          messages: { select: { senderId: true, body: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      db.ticket.findMany({
        where: { fromId: id },
        select: {
          id: true,
          category: true,
          subject: true,
          body: true,
          state: true,
          createdAt: true,
          replies: { select: { body: true, createdAt: true, author: who }, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      db.notification.findMany({ where: { userId: id }, select: { type: true, payload: true, readAt: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
    ]);
    res.attachment(`digital-campus-export-${id}.json`);
    res.json({
      exportedAt: new Date().toISOString(),
      user,
      profile,
      classes,
      attendance,
      projects,
      boardPosts,
      classPosts,
      conversations: conversations.map(({ fromId, ...c }) => ({ ...c, state: visibleState({ fromId, state: c.state }, id) })),
      tickets,
      notifications,
    });
  },
);
