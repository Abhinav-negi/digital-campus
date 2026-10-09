import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { notify } from '../../lib/notify.js';
import { registry, route } from '../../lib/openapi.js';
import { unblocked } from './safety.js';
import { perUser } from '../../lib/auth.js';
import { CLOSED, authorOnly, boardPostDetail, findPost, gigDone, helpersOf, isOpen, postDetail, studentOnly } from './board.js';

// CM-03: what people do on a post (SPEC §9.2 actions, §9.6 thanks; PROTO student.html:305-339, :596-599, :630-632).
// Every action answers with the post as I now see it (BoardPostDetail). Post-linked messages are CM-06.

const router = Router();
const idParams = z.object({ id: z.string().min(1) });
type Id = z.infer<typeof idParams>;
const ok = { 200: boardPostDetail };

const notOpen = (what: string) => new HttpError(422, 'NOT_OPEN', `This ${what} is not open`);

const answerBody = z.object({ body: z.string().trim().min(1).max(2000) });
router.post(
  '/board-posts/:id/answers',
  perUser(30, 60_000),
  route(registry, {
    method: 'post',
    path: '/commons/board-posts/:id/answers',
    summary: 'Answer an open Ask publicly; the poster is notified',
    guard: 'commons',
    request: { params: idParams, body: answerBody },
    responses: { 201: boardPostDetail, 403: null, 404: null },
  }),
  async (req, res) => {
    const me = req.user!;
    studentOnly(me);
    const { p } = await findPost((req.params as Id).id, me);
    if (p.kind !== 'ask' || !isOpen(p)) throw notOpen('ask');
    await db.$transaction(async (tx) => {
      await tx.answer.create({ data: { postId: p.id, authorId: me.id, body: (req.body as z.infer<typeof answerBody>).body } });
      if (p.authorId !== me.id) await notify([p.authorId], 'board-answer', { text: `${me.name} answered your Ask "${p.title}"`, postId: p.id }, tx);
    });
    res.status(201).json(await postDetail(p.id, me));
  },
);

const interestBody = z.object({ note: z.string().trim().min(1).max(300) });
router.post(
  '/board-posts/:id/interests',
  route(registry, {
    method: 'post',
    path: '/commons/board-posts/:id/interests',
    summary: "I'm interested in an open Gig, with a short note (once, not my own); the poster is notified",
    guard: 'commons',
    request: { params: idParams, body: interestBody },
    responses: { 201: boardPostDetail, 403: null, 404: null, 409: null },
  }),
  async (req, res) => {
    const me = req.user!;
    studentOnly(me);
    const { p } = await findPost((req.params as Id).id, me);
    if (p.kind !== 'gig' || !isOpen(p)) throw notOpen('gig');
    if (p.authorId === me.id) throw new HttpError(403, 'FORBIDDEN', "That's your own gig");
    if (p.interests.some((i) => i.userId === me.id)) throw new HttpError(409, 'CONFLICT', 'You already said you are interested');
    await db.$transaction(async (tx) => {
      await tx.interest.create({ data: { postId: p.id, userId: me.id, note: (req.body as z.infer<typeof interestBody>).note } });
      await notify([p.authorId], 'board-interest', { text: `${me.name} is interested in "${p.title}"`, postId: p.id }, tx);
    });
    res.status(201).json(await postDetail(p.id, me));
  },
);

const assignBody = z.object({ userId: z.string().min(1) });
router.post(
  '/board-posts/:id/assign',
  route(registry, {
    method: 'post',
    path: '/commons/board-posts/:id/assign',
    summary: 'The poster picks one interested person; the gig becomes Assigned and they are notified',
    guard: 'commons',
    request: { params: idParams, body: assignBody },
    responses: { ...ok, 403: null, 404: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const { userId } = req.body as z.infer<typeof assignBody>;
    const { p } = await findPost((req.params as Id).id, me);
    authorOnly(p, me);
    if (p.kind !== 'gig' || !isOpen(p)) throw notOpen('gig');
    if (!p.interests.some((i) => i.userId === userId)) throw new HttpError(422, 'VALIDATION', 'Only someone who is interested can be assigned');
    await db.$transaction(async (tx) => {
      await tx.boardPost.update({ where: { id: p.id }, data: { status: 'assigned', assigneeId: userId } });
      await notify(await unblocked(me.id, [userId]), 'board-assigned', { text: `You were picked for "${p.title}"`, postId: p.id }, tx);
    });
    res.json(await postDetail(p.id, me));
  },
);

router.post(
  '/board-posts/:id/done',
  route(registry, {
    method: 'post',
    path: '/commons/board-posts/:id/done',
    summary: 'The poster marks an assigned gig Done; the assignee is thanked automatically',
    guard: 'commons',
    request: { params: idParams },
    responses: { ...ok, 403: null, 404: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const { p } = await findPost((req.params as Id).id, me);
    authorOnly(p, me);
    if (p.kind !== 'gig' || p.status !== 'assigned') throw new HttpError(422, 'INVALID_TRANSITION', 'Only an assigned gig can be marked done');
    await gigDone(p, me);
    res.json(await postDetail(p.id, me));
  },
);

const claimBody = z.object({ answer: z.string().trim().min(1).max(200) });
router.post(
  '/board-posts/:id/claims',
  route(registry, {
    method: 'post',
    path: '/commons/board-posts/:id/claims',
    summary: "It's mine: describe the hidden detail of an open Found post (once, not my own); the finder is notified",
    guard: 'commons',
    request: { params: idParams, body: claimBody },
    responses: { 201: boardPostDetail, 403: null, 404: null, 409: null },
  }),
  async (req, res) => {
    const me = req.user!;
    studentOnly(me);
    const { p } = await findPost((req.params as Id).id, me);
    if (p.kind !== 'found' || !isOpen(p)) throw notOpen('found post');
    if (p.authorId === me.id) throw new HttpError(403, 'FORBIDDEN', "That's your own post");
    if (p.claims.some((c) => c.userId === me.id)) throw new HttpError(409, 'CONFLICT', 'You already claimed this');
    await db.$transaction(async (tx) => {
      await tx.claim.create({ data: { postId: p.id, userId: me.id, answer: (req.body as z.infer<typeof claimBody>).answer } });
      await notify([p.authorId], 'board-claim', { text: `${me.name} says "${p.title}" is theirs`, postId: p.id }, tx);
    });
    res.status(201).json(await postDetail(p.id, me));
  },
);

const claimParams = idParams.extend({ claimId: z.string().min(1) });
router.post(
  '/board-posts/:id/claims/:claimId/confirm',
  route(registry, {
    method: 'post',
    path: '/commons/board-posts/:id/claims/:claimId/confirm',
    summary: 'The finder confirms a claim: the post is Returned, other claims are declined, the claimer is notified',
    guard: 'commons',
    request: { params: claimParams },
    responses: { ...ok, 403: null, 404: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const { id, claimId } = req.params as z.infer<typeof claimParams>;
    const { p } = await findPost(id, me);
    authorOnly(p, me);
    const claim = p.claims.find((c) => c.id === claimId);
    if (!claim) throw new HttpError(404, 'NOT_FOUND', 'Claim not found');
    if (p.status !== 'open' || claim.state !== 'pending') throw notOpen('claim');
    await db.$transaction(async (tx) => {
      await tx.boardPost.update({ where: { id }, data: { status: 'returned' } });
      await tx.claim.update({ where: { id: claimId }, data: { state: 'confirmed' } });
      await tx.claim.updateMany({ where: { postId: id, id: { not: claimId } }, data: { state: 'declined' } });
      await notify(await unblocked(me.id, [claim.userId]), 'board-claim', { text: `Your claim on "${p.title}" was confirmed`, postId: id }, tx);
    });
    res.json(await postDetail(id, me));
  },
);

const thanksBody = z.object({ postId: z.string().min(1), toId: z.string().min(1) });
router.post(
  '/thanks',
  route(registry, {
    method: 'post',
    path: '/commons/thanks',
    summary: 'The poster thanks someone who helped on a closed post (answerer, assignee, confirmed claimer); once per person per post',
    guard: 'commons',
    request: { body: thanksBody },
    responses: { 201: boardPostDetail, 403: null, 404: null, 409: null },
  }),
  async (req, res) => {
    const me = req.user!;
    const { postId, toId } = req.body as z.infer<typeof thanksBody>;
    const { p } = await findPost(postId, me);
    authorOnly(p, me);
    if (!CLOSED.includes(p.status)) throw new HttpError(422, 'NOT_CLOSED', 'Thank people once the post is closed');
    if (!helpersOf(p).includes(toId)) throw new HttpError(422, 'VALIDATION', 'Only someone who helped on this post can be thanked');
    // ponytail: no unique (postId, toId) in the frozen schema, so a double-tap race could write two; the check stops the rest.
    if (p.thanks.some((t) => t.toId === toId)) throw new HttpError(409, 'CONFLICT', 'You already thanked them for this post');
    await db.$transaction(async (tx) => {
      await tx.thanks.create({ data: { fromId: me.id, toId, postId } });
      await notify(await unblocked(me.id, [toId]), 'thanks', { text: `You were thanked by ${me.name} for "${p.title}"`, postId }, tx);
    });
    res.status(201).json(await postDetail(postId, me));
  },
);

export default router;
