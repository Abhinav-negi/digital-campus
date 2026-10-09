import type { BoardPostStatus, Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../../lib/auth.js';
import { addDays, today } from '../../lib/dates.js';
import { db } from '../../lib/db.js';
import { HttpError, pageQuery } from '../../lib/http.js';
import { notify } from '../../lib/notify.js';
import { registry, route } from '../../lib/openapi.js';
import { personCard, personSelect, toCard, viewerOf } from './profiles.js';
import { blockedEitherWay, blockedIds, unblocked } from './safety.js';

// CM-02: the Board (SPEC §9.2, §9.5; PROTO student.html:249-304). No email is ever selected (personSelect has none).

const KINDS = ['ask', 'gig', 'market', 'lost', 'found'] as const;
const STATUSES = ['open', 'assigned', 'solved', 'done', 'sold', 'given', 'returned', 'expired'] as const;
export const CLOSED: BoardPostStatus[] = ['solved', 'sold', 'given', 'returned', 'done'];
const EXPIRES = { ask: 14, market: 30, lost: 30, found: 30 } as const; // a gig expires on its deadline
const EXTEND = { ask: 14, gig: 14, market: 30, lost: 30, found: 30 } as const;
const DAILY_POSTS = 5;
const MAX_GIG_DAYS = 90;

const ymd = (d: Date | null) => d && d.toISOString().slice(0, 10);
/** Is the instant `t` on the institution's calendar day `on`? */
export const sameDay = (t: Date, on = today()) => today(undefined, t).getTime() === on.getTime();

// --- schemas ---
const byline = personCard.pick({ id: true, name: true, label: true, otherBranch: true }).meta({ id: 'Byline' });
const action = z.enum(['answer', 'interest', 'claim', 'message', 'assign', 'confirm', 'solved', 'done', 'sold', 'given', 'returned', 'extend', 'delete', 'thank']);

const boardPostCard = z
  .object({
    id: z.string(),
    kind: z.enum(KINDS),
    title: z.string(),
    body: z.string().nullable(),
    tags: z.array(z.string()),
    price: z.number().int().nullable(),
    priceType: z.enum(['fixed', 'negotiable']).nullable(),
    marketType: z.enum(['sell', 'buy', 'give', 'lend']).nullable(),
    condition: z.string().nullable(),
    place: z.string().nullable(),
    /** YYYY-MM-DD */
    happenedOn: z.string().nullable(),
    holder: z.string().nullable(),
    /** YYYY-MM-DD */
    deadline: z.string().nullable(),
    status: z.enum(STATUSES),
    /** Only in an admin's `includeHidden` list, on hidden items. */
    hiddenAt: z.iso.datetime().optional(),
    /** YYYY-MM-DD: live while ≥ today in the institution's timezone. */
    expiresAt: z.string(),
    createdAt: z.string(),
    author: byline,
    /** answers (ask) / interested (gig) / claims (found); 0 otherwise. */
    count: z.number().int(),
  })
  .meta({ id: 'BoardPostCard' });

export const boardPostDetail = boardPostCard
  .extend({
    mine: z.boolean(),
    /** Found posts: only the author (and admins) ever see it; null for everyone else. */
    hiddenDetail: z.string().nullable(),
    assignee: byline.nullable(),
    answers: z.array(z.object({ id: z.string(), body: z.string(), createdAt: z.string(), author: byline })),
    /** The author and admins see every one; anyone else only their own. */
    interests: z.array(z.object({ id: z.string(), note: z.string(), createdAt: z.string(), user: byline })),
    claims: z.array(z.object({ id: z.string(), answer: z.string(), state: z.enum(['pending', 'confirmed', 'declined']), createdAt: z.string(), user: byline })),
    /** User ids the author already thanked for this post. */
    thanked: z.array(z.string()),
    /** What I may do now: an action endpoint, a status for PATCH …/status, or "message" (CM-06). */
    actions: z.array(action),
  })
  .meta({ id: 'BoardPostDetail' });
type Detail = z.infer<typeof boardPostDetail>;

// --- reads ---
type Viewer = { branchId: string | null; on: Date };
type PersonRow = Parameters<typeof toCard>[0];
const by = (u: PersonRow, v: Viewer) => {
  const { id, name, label, otherBranch } = toCard(u, v.branchId, v.on);
  return { id, name, label, otherBranch };
};

const cardInclude = { author: { select: personSelect }, _count: { select: { answers: true, interests: true, claims: true } } } satisfies Prisma.BoardPostInclude;
type CardRow = Prisma.BoardPostGetPayload<{ include: typeof cardInclude }>;

const toPostCard = (p: CardRow, v: Viewer): z.infer<typeof boardPostCard> => ({
  id: p.id,
  kind: p.kind,
  title: p.title,
  body: p.body,
  tags: p.tags,
  price: p.price,
  priceType: p.priceType,
  marketType: p.marketType,
  condition: p.condition,
  place: p.place,
  happenedOn: ymd(p.happenedOn),
  holder: p.holder,
  deadline: ymd(p.deadline),
  status: p.status,
  expiresAt: ymd(p.expiresAt)!,
  createdAt: p.createdAt.toISOString(),
  author: by(p.author, v),
  count: p.kind === 'ask' ? p._count.answers : p.kind === 'gig' ? p._count.interests : p.kind === 'found' ? p._count.claims : 0,
});

const detailInclude = {
  ...cardInclude,
  assignee: { select: personSelect },
  answers: { include: { author: { select: personSelect } }, orderBy: { createdAt: 'asc' } },
  interests: { include: { user: { select: personSelect } }, orderBy: { createdAt: 'asc' } },
  claims: { include: { user: { select: personSelect } }, orderBy: { createdAt: 'asc' } },
  thanks: { select: { toId: true } },
} satisfies Prisma.BoardPostInclude;
export type PostRow = Prisma.BoardPostGetPayload<{ include: typeof detailInclude }>;

/** The one status the author may move this post to (PROTO bpSheet), or null. */
export const nextStatus = (p: Pick<PostRow, 'kind' | 'status' | 'marketType'>): BoardPostStatus | null => {
  if (p.kind === 'gig') return p.status === 'assigned' ? 'done' : null;
  if (p.status !== 'open') return null;
  if (p.kind === 'ask') return 'solved';
  if (p.kind === 'market') return p.marketType === 'give' || p.marketType === 'lend' ? 'given' : 'sold';
  return 'returned';
};

/** Who helped, so may be thanked (SPEC §9.6): answerers, the assignee, the confirmed claimer. */
export const helpersOf = (p: PostRow) =>
  [
    ...new Set(
      p.kind === 'ask'
        ? p.answers.map((a) => a.authorId)
        : p.kind === 'gig'
          ? [p.assigneeId]
          : p.kind === 'found'
            ? p.claims.filter((c) => c.state === 'confirmed').map((c) => c.userId)
            : [],
    ),
  ].filter((id): id is string => !!id && id !== p.authorId);

/** Open and still live: the only state others can act on. */
export const isOpen = (p: Pick<PostRow, 'status' | 'expiresAt' | 'hiddenAt'>, on = today()) =>
  p.status === 'open' && !p.hiddenAt && p.expiresAt >= on;

/** A post in my institution; a hidden one only for its author and admins. 404 otherwise. */
export const findPost = async (id: string, me: AuthUser) => {
  const [viewer, p] = await Promise.all([viewerOf(me.id), db.boardPost.findUnique({ where: { id }, include: { ...detailInclude, author: { select: { ...personSelect, institutionId: true } } } })]);
  if (!p || p.author.institutionId !== viewer.institutionId || (p.hiddenAt && p.authorId !== me.id && !me.isAdmin))
    throw new HttpError(404, 'NOT_FOUND', 'Post not found');
  if (p.authorId !== me.id && (await blockedEitherWay(me.id, p.authorId))) throw new HttpError(404, 'NOT_FOUND', 'Post not found');
  return { p, viewer: { branchId: viewer.homeClass?.branchId ?? null, on: today() } };
};

/** The post as `me` sees it: private parts (hidden detail, others' notes and claims) only for the author and admins. */
export const postDetail = async (id: string, me: AuthUser): Promise<Detail> => {
  const { p, viewer: v } = await findPost(id, me);
  const mine = p.authorId === me.id;
  const full = mine || me.isAdmin;
  const student = me.role === 'student';
  const open = isOpen(p, v.on);
  const thanked = [...new Set(p.thanks.map((t) => t.toId))];
  const actions: z.infer<typeof action>[] = [];
  if (open && student && p.kind === 'ask') actions.push('answer');
  if (open && student && !mine && p.kind === 'gig' && !p.interests.some((i) => i.userId === me.id)) actions.push('interest');
  if (open && student && !mine && p.kind === 'found' && !p.claims.some((c) => c.userId === me.id)) actions.push('claim');
  if (open && student && !mine && (p.kind === 'market' || p.kind === 'lost')) actions.push('message');
  if (mine) {
    if (open && p.kind === 'gig' && p.interests.length) actions.push('assign');
    if (open && p.kind === 'found' && p.claims.some((c) => c.state === 'pending')) actions.push('confirm');
    const next = nextStatus(p);
    if (next) actions.push(next as z.infer<typeof action>);
    if (!CLOSED.includes(p.status)) actions.push('extend');
    actions.push('delete');
    if (CLOSED.includes(p.status) && helpersOf(p).some((u) => !thanked.includes(u))) actions.push('thank');
  }
  return {
    ...toPostCard(p, v),
    mine,
    hiddenDetail: full ? p.hiddenDetail : null,
    assignee: p.assignee && by(p.assignee, v),
    answers: p.answers.map((a) => ({ id: a.id, body: a.body, createdAt: a.createdAt.toISOString(), author: by(a.author, v) })),
    interests: p.interests
      .filter((i) => full || i.userId === me.id)
      .map((i) => ({ id: i.id, note: i.note, createdAt: i.createdAt.toISOString(), user: by(i.user, v) })),
    claims: p.claims
      .filter((c) => full || c.userId === me.id)
      .map((c) => ({ id: c.id, answer: c.answer, state: c.state, createdAt: c.createdAt.toISOString(), user: by(c.user, v) })),
    thanked,
    actions,
  };
};

/** The author marks an assigned gig done: status done + an automatic Thanks to the assignee (PROTO gigdone). */
export const gigDone = (p: PostRow, me: AuthUser) =>
  db.$transaction(async (tx) => {
    await tx.boardPost.update({ where: { id: p.id }, data: { status: 'done' } });
    await tx.thanks.create({ data: { fromId: me.id, toId: p.assigneeId!, postId: p.id } });
    await notify(await unblocked(me.id, [p.assigneeId!]), 'thanks', { text: `${me.name} marked "${p.title}" done and thanked you`, postId: p.id }, tx);
  });

/** 403 unless I wrote the post (admins included: moderation is AD-06). */
export const authorOnly = (p: { authorId: string }, me: AuthUser) => {
  if (p.authorId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the poster can do that');
};
/** Posting and replying are for students; admins only read (they pass the wall to moderate). */
export const studentOnly = (me: AuthUser) => {
  if (me.role !== 'student') throw new HttpError(403, 'FORBIDDEN', 'Only students can do that');
};

// --- routes ---
const router = Router();
const idParams = z.object({ id: z.string().min(1) });

const feedQuery = pageQuery.extend({
  kind: z.enum(['all', 'ask', 'gig', 'market', 'lf']).default('all'),
  branchId: z.string().min(1).optional(),
  q: z.string().trim().max(100).optional(),
  /** 'true' = only my posts, expired and closed included (hidden ones still drop out). */
  mine: z.enum(['true', 'false']).optional(),
  /** Admins only: also return hidden posts, each with `hiddenAt`. Ignored for everyone else. */
  includeHidden: z.enum(['1', 'true']).optional(),
});

router.get(
  '/board-posts',
  route(registry, {
    method: 'get',
    path: '/commons/board-posts',
    summary: 'The Board: live posts (not hidden, not expired), newest day first, closed after open on the same day; lf = lost + found',
    guard: 'commons',
    request: { query: feedQuery },
    responses: { 200: z.object({ items: z.array(boardPostCard), nextCursor: z.string().nullable() }) },
  }),
  async (req, res) => {
    const { kind, branchId, q, mine, includeHidden, cursor, limit } = req.query as unknown as z.infer<typeof feedQuery>;
    const withHidden = !!includeHidden && req.user!.isAdmin; // the wall: students' includeHidden is ignored
    const viewer = await viewerOf(req.user!.id);
    const v = { branchId: viewer.homeClass?.branchId ?? null, on: today() };
    const blocked = await blockedIds(req.user!.id);
    // ponytail: the live set is small (5 posts/student/day, ≤30-day expiry), so we load it and order by the
    // institution's day in memory, like People. Past a few thousand live posts, persist a day column and page in SQL.
    const rows = await db.boardPost.findMany({
      where: {
        ...(!withHidden && { hiddenAt: null }),
        authorId: mine === 'true' ? req.user!.id : { notIn: blocked },
        ...(mine !== 'true' && { expiresAt: { gte: v.on } }),
        ...(kind !== 'all' && { kind: kind === 'lf' ? { in: ['lost', 'found'] } : kind }),
        author: { institutionId: viewer.institutionId, ...(branchId && { homeClass: { is: { branchId } } }) },
      },
      include: cardInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const needle = q?.toLowerCase();
    const day = new Map(rows.map((p) => [p.id, today(undefined, p.createdAt).getTime()]));
    const list = rows
      .filter((p) => !needle || [p.title, p.body ?? '', ...p.tags].join(' ').toLowerCase().includes(needle))
      .sort((a, b) => day.get(b.id)! - day.get(a.id)! || +CLOSED.includes(a.status) - +CLOSED.includes(b.status));
    const start = cursor ? list.findIndex((p) => p.id === cursor) + 1 : 0;
    const items = list.slice(start, start + limit + 1);
    res.json({ items: items.slice(0, limit).map((p) => ({ ...toPostCard(p, v), ...(withHidden && p.hiddenAt && { hiddenAt: p.hiddenAt.toISOString() }) })), nextCursor: items.length > limit ? items[limit - 1]!.id : null });
  },
);

const title = z.string().trim().min(1).max(140);
const body = z.string().trim().max(2000).optional();
const tags = z.array(z.string().trim().min(1).max(40)).max(10).default([]);
const place = z.string().trim().min(1).max(100);
const price = z.number().int().min(0).max(100_000);
const createBody = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('ask'), title, body, tags }),
    z.object({
      kind: z.literal('gig'),
      title,
      body: z.string().trim().min(1).max(2000),
      tags,
      price: price.min(1),
      priceType: z.enum(['fixed', 'negotiable']).default('fixed'),
      /** YYYY-MM-DD, today … +90 days; the gig expires on it. */
      deadline: z.iso.date(),
    }),
    z.object({
      kind: z.literal('market'),
      marketType: z.enum(['sell', 'buy', 'give', 'lend']),
      title,
      /** 0 = Free */
      price,
      condition: z.enum(['New', 'Good', 'Used', 'Any']),
      /** A public campus spot (SPEC §9.5), e.g. "Library entrance". */
      place: place.optional(),
      body,
    }),
    z.object({ kind: z.literal('lost'), title, place, /** YYYY-MM-DD, default today */ happenedOn: z.iso.date().optional(), body }),
    z.object({
      kind: z.literal('found'),
      title,
      place,
      holder: z.string().trim().min(1).max(100),
      hiddenDetail: z.string().trim().min(1).max(200),
      happenedOn: z.iso.date().optional(),
      body,
    }),
  ])
  .meta({ id: 'BoardPostCreate' });

router.post(
  '/board-posts',
  route(registry, {
    method: 'post',
    path: '/commons/board-posts',
    summary: 'Post to the Board (students; 5 a day). Expires: ask 14 days, gig on its deadline, market/lost/found 30 days',
    guard: 'commons',
    request: { body: createBody },
    responses: { 201: boardPostDetail, 403: null, 429: null },
  }),
  async (req, res) => {
    const me = req.user!;
    studentOnly(me);
    const input = req.body as z.infer<typeof createBody>;
    const on = today();
    // The cap counts by the institution's day: fetch from a day early (covers any tz offset), then compare days.
    // ponytail: check-then-insert, so two simultaneous posts can both slip in as the 5th; fine for a soft limit.
    const recent = await db.boardPost.findMany({ where: { authorId: me.id, createdAt: { gte: addDays(on, -1) } }, select: { createdAt: true } });
    if (recent.filter((p) => sameDay(p.createdAt, on)).length >= DAILY_POSTS) throw new HttpError(429, 'RATE_LIMITED', 'You have used your 5 posts for today');

    const date = (s: string | undefined) => (s ? new Date(s) : on);
    let data: Omit<Prisma.BoardPostUncheckedCreateInput, 'authorId'>;
    if (input.kind === 'gig') {
      const deadline = new Date(input.deadline);
      if (deadline < on || deadline > addDays(on, MAX_GIG_DAYS)) throw new HttpError(422, 'VALIDATION', `The deadline must be within the next ${MAX_GIG_DAYS} days`);
      data = { ...input, deadline, expiresAt: deadline };
    } else if (input.kind === 'lost' || input.kind === 'found') {
      const happenedOn = date(input.happenedOn);
      if (happenedOn > on) throw new HttpError(422, 'VALIDATION', 'happenedOn is in the future');
      data = { ...input, happenedOn, expiresAt: addDays(on, EXPIRES[input.kind]) };
    } else data = { ...input, expiresAt: addDays(on, EXPIRES[input.kind]) };

    const post = await db.boardPost.create({ data: { ...data, authorId: me.id } });
    if (post.kind === 'ask' || post.kind === 'gig') await routeToHelpers(post, me.id);
    res.status(201).json(await postDetail(post.id, me));
  },
);

/**
 * Smart routing (SPEC §9.2), quietly: students whose skills match a tag, plus helps-juniors students senior to the
 * poster, get one 'board-match' notification a day at most. People in Focus are skipped.
 */
const routeToHelpers = async (p: { id: string; kind: string; title: string; tags: string[] }, authorId: string) => {
  const on = today();
  const author = await db.user.findUniqueOrThrow({ where: { id: authorId }, select: { ...personSelect, institutionId: true } });
  const year = toCard(author, null, on).year;
  const rows = await db.user.findMany({
    where: { institutionId: author.institutionId, role: 'student', status: 'active', bannedAt: null, id: { not: authorId }, profile: { isNot: null } },
    select: personSelect,
  });
  const wanted = new Set(p.tags.map((t) => t.toLowerCase()));
  const ids = rows
    .map((u) => toCard(u, null, on))
    .filter((c) => c.availability !== 'focus')
    .filter((c) => c.skills.some((s) => wanted.has(s.toLowerCase())) || (c.helpsJuniors && !!year && !!c.year && c.year > year))
    .map((c) => c.id);
  if (!ids.length) return;
  const sent = await db.notification.findMany({ where: { userId: { in: ids }, type: 'board-match', createdAt: { gte: addDays(on, -1) } }, select: { userId: true, createdAt: true } });
  const skip = new Set(sent.filter((n) => sameDay(n.createdAt, on)).map((n) => n.userId));
  await notify(await unblocked(authorId, ids.filter((id) => !skip.has(id))), 'board-match', { text: `A new ${p.kind === 'ask' ? 'Ask' : 'Gig'} you could help with: "${p.title}"`, postId: p.id });
};

router.get(
  '/board-posts/:id',
  route(registry, {
    method: 'get',
    path: '/commons/board-posts/:id',
    summary: "A post with its answers/interests/claims and the actions I may take; Found's hidden detail only for the author",
    guard: 'commons',
    request: { params: idParams },
    responses: { 200: boardPostDetail, 404: null },
  }),
  async (req, res) => {
    res.json(await postDetail((req.params as z.infer<typeof idParams>).id, req.user!));
  },
);

const statusBody = z.object({ status: z.enum(['solved', 'done', 'sold', 'given', 'returned']) });

router.patch(
  '/board-posts/:id/status',
  route(registry, {
    method: 'patch',
    path: '/commons/board-posts/:id/status',
    summary: 'Close my post: ask → solved, assigned gig → done (+ Thanks), market → sold/given, lost/found → returned; else 422',
    guard: 'commons',
    request: { params: idParams, body: statusBody },
    responses: { 200: boardPostDetail, 403: null, 404: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const { id } = req.params as z.infer<typeof idParams>;
    const { status } = req.body as z.infer<typeof statusBody>;
    const { p } = await findPost(id, me);
    authorOnly(p, me);
    if (nextStatus(p) !== status) throw new HttpError(422, 'INVALID_TRANSITION', `A ${p.status} ${p.kind} can't be marked ${status}`);
    if (status === 'done') await gigDone(p, me);
    else
      await db.$transaction([
        db.boardPost.update({ where: { id }, data: { status } }),
        // Returned without a confirmed claim (e.g. handed to the office): pending claims are declined.
        db.claim.updateMany({ where: { postId: id, state: 'pending' }, data: { state: 'declined' } }),
      ]);
    res.json(await postDetail(id, me));
  },
);

router.post(
  '/board-posts/:id/extend',
  route(registry, {
    method: 'post',
    path: '/commons/board-posts/:id/extend',
    summary: 'Keep my open post up longer: +14 days (ask, gig) or +30 (market, lost, found) from today or its expiry, whichever is later',
    guard: 'commons',
    request: { params: idParams },
    responses: { 200: boardPostDetail, 403: null, 404: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const { id } = req.params as z.infer<typeof idParams>;
    const { p } = await findPost(id, me);
    authorOnly(p, me);
    if (CLOSED.includes(p.status)) throw new HttpError(422, 'INVALID_TRANSITION', 'This post is closed');
    const on = today();
    const expiresAt = addDays(p.expiresAt > on ? p.expiresAt : on, EXTEND[p.kind]);
    await db.boardPost.update({ where: { id }, data: { expiresAt, ...(p.kind === 'gig' && { deadline: expiresAt }) } });
    res.json(await postDetail(id, me));
  },
);

router.delete(
  '/board-posts/:id',
  route(registry, {
    method: 'delete',
    path: '/commons/board-posts/:id',
    summary: 'Delete my post (its answers, interests and claims go with it; thanks and conversations stay)',
    guard: 'commons',
    request: { params: idParams },
    responses: { 204: null, 403: null, 404: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const { id } = req.params as z.infer<typeof idParams>;
    authorOnly((await findPost(id, me)).p, me);
    await db.boardPost.delete({ where: { id } });
    res.status(204).end();
  },
);

export default router;
