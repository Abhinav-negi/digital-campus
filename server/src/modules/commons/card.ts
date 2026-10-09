import { Router } from 'express';
import { z } from 'zod';
import { today } from '../../lib/dates.js';
import { db } from '../../lib/db.js';
import { registry, route } from '../../lib/openapi.js';
import { byline, by } from './projects.js';
import { personSelect, viewerOf } from './profiles.js';
import { blockedIds } from './safety.js';

// CM-08: the "From the Commons" dashboard card (SPEC §7.3 item 5; PROTO student.html:178-193).
// An ordered list; the client rotates through it. Blocked people and hidden items never appear.

const card = z
  .object({
    type: z.enum(['answer', 'join-requests', 'ask', 'project']),
    title: z.string(),
    body: z.string(),
    /** The board post or project to open. */
    refId: z.string(),
    byline: byline.optional(),
  })
  .meta({ id: 'CommonsCard' });

const router = Router();

router.get(
  '/card',
  route(registry, {
    method: 'get',
    path: '/commons/card',
    summary: 'Dashboard cards: newest answer on my Ask, join requests on my projects, an unanswered ask/gig or a project matching my skills',
    guard: 'commons',
    responses: { 200: z.object({ items: z.array(card) }) },
  }),
  async (req, res) => {
    const me = req.user!.id;
    const viewer = await viewerOf(me);
    const v = { branchId: viewer.homeClass?.branchId ?? null, on: today() };
    const blocked = await blockedIds(me);
    const here = { institutionId: viewer.institutionId };
    const skills = ((await db.profile.findUnique({ where: { userId: me }, select: { skills: true } }))?.skills ?? []).map((s) => s.toLowerCase());
    const items: z.infer<typeof card>[] = [];

    const answer = await db.answer.findFirst({
      where: { authorId: { notIn: [me, ...blocked] }, post: { authorId: me, hiddenAt: null } },
      orderBy: { createdAt: 'desc' },
      include: { post: { select: { id: true, title: true } }, author: { select: personSelect } },
    });
    if (answer) items.push({ type: 'answer', title: answer.post.title, body: answer.body, refId: answer.post.id, byline: by(answer.author, v) });

    const pending = await db.joinRequest.findMany({
      where: { state: 'pending', userId: { notIn: blocked }, project: { ownerId: me, hiddenAt: null } },
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { id: true, title: true } }, user: { select: personSelect } },
    });
    if (pending[0]) {
      const [first] = pending;
      const n = pending.length;
      items.push({
        type: 'join-requests',
        title: `${n} ${n > 1 ? 'people want' : 'person wants'} to join ${first.project.title}`,
        body: `${first.user.name}: "${first.note ?? ''}"`,
        refId: first.project.id,
        byline: by(first.user, v),
      });
    }

    const match = (tags: string[]) => tags.some((t) => skills.some((s) => t.toLowerCase().includes(s) || s.includes(t.toLowerCase())));
    // ponytail: skill matching is in memory over the live open asks/gigs; fine at campus scale, push into SQL if the feed grows.
    const asks = await db.boardPost.findMany({
      where: { kind: { in: ['ask', 'gig'] }, status: 'open', hiddenAt: null, expiresAt: { gte: v.on }, authorId: { notIn: [me, ...blocked] }, author: here, answers: { none: {} }, interests: { none: {} } },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: personSelect } },
      take: 200, // ponytail: hard cap; the card only needs the first skill match
    });
    const ask = asks.find((p) => match(p.tags));
    if (ask) items.push({ type: 'ask', title: ask.title, body: ask.body ?? '', refId: ask.id, byline: by(ask.author, v) });

    const projects = await db.project.findMany({
      where: { hiddenAt: null, status: { not: 'shipped' }, ownerId: { notIn: blocked }, owner: here, members: { none: { userId: me } } },
      orderBy: { createdAt: 'desc' },
      take: 200, // ponytail: hard cap, as above
    });
    const proj = projects.find((p) => p.roles.some((r) => skills.includes(r.toLowerCase()))) ?? projects.find((p) => p.status === 'looking');
    if (proj) items.push({ type: 'project', title: proj.title, body: proj.description, refId: proj.id });

    res.json({ items });
  },
);

export default router;
