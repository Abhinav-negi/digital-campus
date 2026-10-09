import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../../lib/auth.js';
import { addDays, today } from '../../lib/dates.js';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { notify } from '../../lib/notify.js';
import { registry, route } from '../../lib/openapi.js';
import { studentOnly } from './board.js';
import { personSelect } from './profiles.js';
import { by, byline, viewer, type Viewer } from './projects.js';

// CM-05: challenges, submissions, likes, winners (SPEC §9.3; PROTO student.html:405-432, :612, :634).

const MAX_DAYS = 365;

// --- schemas ---
const challengeCard = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    /** YYYY-MM-DD: live through that day (institution calendar). */
    endsAt: z.string(),
    live: z.boolean(),
    judging: z.enum(['owner', 'likes']),
    featured: z.boolean(),
    /** Only in an admin's `includeHidden` list, on hidden items. */
    hiddenAt: z.iso.datetime().optional(),
    owner: byline,
    submissionCount: z.number().int(),
    /** The owner's picks; for judging=likes once ended, the most-liked (ties all win, none with 0 likes). */
    winners: z.array(byline),
    createdAt: z.string(),
  })
  .meta({ id: 'ChallengeCard' });

const challengeDetail = challengeCard
  .extend({
    mine: z.boolean(),
    /** Most liked first. */
    submissions: z.array(
      z.object({
        id: z.string(),
        /** http(s) for new data; old seed rows may lack the scheme, so the client must check before linking. */
        url: z.string(),
        note: z.string().nullable(),
        likes: z.number().int(),
        likedByMe: z.boolean(),
        createdAt: z.string(),
        user: byline,
      }),
    ),
    canSubmit: z.boolean(),
    canPickWinners: z.boolean(),
  })
  .meta({ id: 'ChallengeDetail' });

// --- reads ---
/** Live through its end date: the stored instant's UTC date, compared with the institution's today. */
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const isLive = (c: { endsAt: Date }, on = today()) => new Date(ymd(c.endsAt)) >= on;

type Sub = { userId: string; createdAt: Date; _count: { likes: number } };
const winnerIds = (c: { endsAt: Date; judging: string; winnerIds: string[] }, subs: Sub[], on: Date) => {
  if (c.winnerIds.length) return c.winnerIds;
  if (c.judging !== 'likes' || isLive(c, on)) return [];
  const top = Math.max(0, ...subs.map((s) => s._count.likes));
  return top ? [...new Set(subs.filter((s) => s._count.likes === top).map((s) => s.userId))] : [];
};

const cardInclude = {
  owner: { select: personSelect },
  submissions: { select: { userId: true, createdAt: true, _count: { select: { likes: true } } }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ChallengeInclude;
type CardRow = Prisma.ChallengeGetPayload<{ include: typeof cardInclude }>;

/** Cards for these rows; winners' bylines in one extra read (winnerIds has no FK). */
const toCards = async (rows: CardRow[], v: Viewer) => {
  const wins = new Map(rows.map((c) => [c.id, winnerIds(c, c.submissions, v.on)]));
  const people = await db.user.findMany({ where: { id: { in: [...new Set([...wins.values()].flat())] } }, select: personSelect });
  const person = new Map(people.map((u) => [u.id, by(u, v)]));
  return rows.map((c): z.infer<typeof challengeCard> => ({
    id: c.id,
    title: c.title,
    description: c.description,
    endsAt: ymd(c.endsAt),
    live: isLive(c, v.on),
    judging: c.judging,
    featured: c.featured,
    owner: by(c.owner, v),
    submissionCount: c.submissions.length,
    winners: wins.get(c.id)!.flatMap((id) => person.get(id) ?? []),
    createdAt: c.createdAt.toISOString(),
  }));
};

/** A challenge in my institution; a hidden one only for its owner and admins. 404 otherwise. */
const findChallenge = async (id: string, me: AuthUser) => {
  const [{ institutionId, v }, c] = await Promise.all([
    viewer(me),
    db.challenge.findUnique({ where: { id }, include: { ...cardInclude, owner: { select: { ...personSelect, institutionId: true } } } }),
  ]);
  if (!c || c.owner.institutionId !== institutionId || (c.hiddenAt && c.ownerId !== me.id && !me.isAdmin))
    throw new HttpError(404, 'NOT_FOUND', 'Challenge not found');
  return { c, v };
};

const challengeView = async (id: string, me: AuthUser): Promise<z.infer<typeof challengeDetail>> => {
  const { c, v } = await findChallenge(id, me);
  const [[card], subs] = await Promise.all([
    toCards([c], v),
    db.submission.findMany({
      where: { challengeId: id },
      include: { user: { select: personSelect }, _count: { select: { likes: true } }, likes: { where: { userId: me.id }, select: { id: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);
  const mine = c.ownerId === me.id;
  return {
    ...card!,
    mine,
    submissions: subs
      .sort((a, b) => b._count.likes - a._count.likes) // stable: ties keep the earliest first
      .map((s) => ({ id: s.id, url: s.url, note: s.note, likes: s._count.likes, likedByMe: s.likes.length > 0, createdAt: s.createdAt.toISOString(), user: by(s.user, v) })),
    canSubmit: card!.live && me.role === 'student' && !subs.some((s) => s.userId === me.id),
    canPickWinners: mine && c.judging === 'owner' && !card!.live,
  };
};

const notLive = () => new HttpError(422, 'NOT_LIVE', 'This challenge has ended');

// --- routes ---
const router = Router();
const idParams = z.object({ id: z.string().min(1) });
type Id = z.infer<typeof idParams>;

router.get(
  '/challenges',
  route(registry, {
    method: 'get',
    path: '/commons/challenges',
    summary: 'Challenges: live ones (ending soonest first), then ended ones (latest first), with submission counts and winners; hidden left out',
    guard: 'commons',
    request: { query: z.object({ includeHidden: z.enum(['1', 'true']).optional() }) },
    responses: { 200: z.object({ items: z.array(challengeCard) }) },
  }),
  async (req, res) => {
    const { institutionId, v } = await viewer(req.user!);
    const withHidden = !!(req.query as { includeHidden?: string }).includeHidden && req.user!.isAdmin; // the wall: students' includeHidden is ignored
    // ponytail: every visible challenge in one read, no paging; a school runs a handful a month.
    const rows = await db.challenge.findMany({ where: { ...(!withHidden && { hiddenAt: null }), owner: { institutionId } }, include: cardInclude });
    const hidden = new Map(rows.map((c) => [c.id, c.hiddenAt]));
    const cards = (await toCards(rows, v)).map((c) => ({ ...c, ...(withHidden && hidden.get(c.id) && { hiddenAt: hidden.get(c.id)!.toISOString() }) }));
    cards.sort((a, b) => +b.live - +a.live || (a.live ? a.endsAt.localeCompare(b.endsAt) : b.endsAt.localeCompare(a.endsAt)));
    res.json({ items: cards });
  },
);

const createBody = z
  .object({
    title: z.string().trim().min(1).max(140),
    description: z.string().trim().min(1).max(2000),
    /** YYYY-MM-DD, today … +365 days; live through that day. */
    endsAt: z.iso.date(),
    judging: z.enum(['owner', 'likes']),
  })
  .meta({ id: 'ChallengeCreate' });

router.post(
  '/challenges',
  route(registry, {
    method: 'post',
    path: '/commons/challenges',
    summary: 'Start a challenge (students): the winner is picked by me (owner) or by the most likes',
    guard: 'commons',
    request: { body: createBody },
    responses: { 201: challengeDetail, 403: null },
  }),
  async (req, res) => {
    const me = req.user!;
    studentOnly(me);
    const input = req.body as z.infer<typeof createBody>;
    const endsAt = new Date(input.endsAt);
    const on = today();
    if (endsAt < on || endsAt > addDays(on, MAX_DAYS)) throw new HttpError(422, 'VALIDATION', `endsAt must be within the next ${MAX_DAYS} days`);
    const c = await db.challenge.create({ data: { ...input, endsAt, ownerId: me.id } });
    res.status(201).json(await challengeView(c.id, me));
  },
);

router.get(
  '/challenges/:id',
  route(registry, {
    method: 'get',
    path: '/commons/challenges/:id',
    summary: 'A challenge with its submissions, most liked first, and whether I liked each',
    guard: 'commons',
    request: { params: idParams },
    responses: { 200: challengeDetail, 404: null },
  }),
  async (req, res) => {
    res.json(await challengeView((req.params as Id).id, req.user!));
  },
);

const submitBody = z.object({
  // Rendered as a link: http(s) only, never javascript: or data:.
  url: z.url({ protocol: /^https?$/ }).trim().max(300),
  note: z.string().trim().max(300).optional(),
});

router.post(
  '/challenges/:id/submissions',
  route(registry, {
    method: 'post',
    path: '/commons/challenges/:id/submissions',
    summary: 'Submit a link to a live challenge (students, once each)',
    guard: 'commons',
    request: { params: idParams, body: submitBody },
    responses: { 201: challengeDetail, 403: null, 404: null, 409: null },
  }),
  async (req, res) => {
    const me = req.user!;
    studentOnly(me);
    const { c } = await findChallenge((req.params as Id).id, me);
    if (!isLive(c)) throw notLive();
    // ponytail: check-then-insert (no unique index on Submission(challengeId, userId)); a double tap can slip in twice.
    if (c.submissions.some((s) => s.userId === me.id)) throw new HttpError(409, 'CONFLICT', 'You already submitted');
    const { url, note } = req.body as z.infer<typeof submitBody>;
    await db.submission.create({ data: { challengeId: c.id, userId: me.id, url, note: note || null } });
    res.status(201).json(await challengeView(c.id, me));
  },
);

router.post(
  '/submissions/:id/like',
  route(registry, {
    method: 'post',
    path: '/commons/submissions/:id/like',
    summary: "Like or unlike a submission (toggle; students; not my own); frozen once the challenge ends",
    guard: 'commons',
    request: { params: idParams },
    responses: { 200: challengeDetail, 403: null, 404: null },
  }),
  async (req, res) => {
    const me = req.user!;
    studentOnly(me);
    const s = await db.submission.findUnique({ where: { id: (req.params as Id).id }, select: { id: true, userId: true, challengeId: true } });
    if (!s) throw new HttpError(404, 'NOT_FOUND', 'Submission not found');
    const { c } = await findChallenge(s.challengeId, me);
    if (!isLive(c)) throw notLive();
    if (s.userId === me.id) throw new HttpError(403, 'FORBIDDEN', "You can't like your own submission");
    // Unique (submissionId, userId): a racing double like loses with a 409.
    const { count } = await db.submissionLike.deleteMany({ where: { submissionId: s.id, userId: me.id } });
    if (!count) await db.submissionLike.create({ data: { submissionId: s.id, userId: me.id } });
    res.json(await challengeView(c.id, me));
  },
);

const winnersBody = z.object({ userIds: z.array(z.string().min(1)).min(1).max(10) });

router.put(
  '/challenges/:id/winners',
  route(registry, {
    method: 'put',
    path: '/commons/challenges/:id/winners',
    summary: 'Pick the winners of my ended, owner-judged challenge (people who submitted); they are notified',
    guard: 'commons',
    request: { params: idParams, body: winnersBody },
    responses: { 200: challengeDetail, 403: null, 404: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const { c } = await findChallenge((req.params as Id).id, me);
    if (c.ownerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the challenge owner can pick winners');
    if (c.judging !== 'owner') throw new HttpError(422, 'VALIDATION', 'This challenge is judged by likes');
    if (isLive(c)) throw new HttpError(422, 'NOT_ENDED', 'Pick winners once the challenge has ended');
    const ids = [...new Set((req.body as z.infer<typeof winnersBody>).userIds)];
    const submitters = new Set(c.submissions.map((s) => s.userId));
    if (!ids.every((id) => submitters.has(id))) throw new HttpError(422, 'VALIDATION', 'Winners must have submitted');
    const fresh = ids.filter((id) => !c.winnerIds.includes(id));
    await db.$transaction(async (tx) => {
      await tx.challenge.update({ where: { id: c.id }, data: { winnerIds: ids } });
      await notify(fresh, 'challenge-winner', { text: `You won "${c.title}"`, challengeId: c.id }, tx);
    });
    res.json(await challengeView(c.id, me));
  },
);

export default router;
