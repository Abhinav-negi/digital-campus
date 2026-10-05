import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../../lib/audit.js';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { registry, route } from '../../lib/openapi.js';

// AD-07: featured (max 3 across projects + challenges) and the one flagship project (SPEC §10, §9.3, Q11).
const MAX_FEATURED = 3;
const LOCK = 7_007; // pg advisory lock key: serialises featured/flagship writes so the cap and the swap are atomic

const item = z.object({ id: z.string(), title: z.string(), ownerName: z.string(), featured: z.boolean() });
const projectItem = item.extend({ community: z.boolean(), flagship: z.boolean() });
const list = z.object({ used: z.number().int(), max: z.number().int(), projects: z.array(projectItem), challenges: z.array(item) });

const router = Router();
const visible = { hiddenAt: null };
const owner = { select: { name: true } } as const;

router.get(
  '/featured',
  route(registry, { method: 'get', path: '/admin/featured', summary: 'Projects and challenges with their featured/flagship flags and the used/3 count', guard: 'admin', responses: { 200: list } }),
  async (_req, res) => {
    const [projects, challenges] = await Promise.all([
      db.project.findMany({ where: visible, include: { owner }, orderBy: { createdAt: 'desc' } }),
      db.challenge.findMany({ where: visible, include: { owner }, orderBy: { createdAt: 'desc' } }),
    ]);
    const row = (x: (typeof projects)[number] | (typeof challenges)[number]) => ({ id: x.id, title: x.title, ownerName: x.owner.name, featured: x.featured });
    res.json({
      used: [...projects, ...challenges].filter((x) => x.featured).length,
      max: MAX_FEATURED,
      projects: projects.map((p) => ({ ...row(p), community: p.community, flagship: p.flagship })),
      challenges: challenges.map(row),
    });
  },
);

const featureBody = z.object({ featured: z.boolean() });
router.put(
  '/featured/:type/:id',
  route(registry, {
    method: 'put',
    path: '/admin/featured/:type/:id',
    summary: 'Feature or unfeature a project or challenge (at most 3 in all)',
    guard: 'admin',
    request: { params: z.object({ type: z.enum(['project', 'challenge']), id: z.string().min(1) }), body: featureBody },
    responses: { 200: z.object({ id: z.string(), featured: z.boolean() }), 404: null, 409: null },
  }),
  async (req, res) => {
    const { featured } = req.body as z.infer<typeof featureBody>;
    const type = req.params.type as 'project' | 'challenge';
    const id = req.params.id as string;
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK})`;
      const model = (type === 'project' ? tx.project : tx.challenge) as typeof tx.project; // same fields used below
      const x = await model.findFirst({ where: { id, ...visible } });
      if (!x) throw new HttpError(404, 'NOT_FOUND', `${type} not found`);
      if (type === 'project' && x.flagship) throw new HttpError(409, 'FLAGSHIP', 'The flagship is shown on its own; pick another flagship first.');
      if (x.featured === featured) return;
      if (featured) {
        const used = (await tx.project.count({ where: { featured: true, ...visible } })) + (await tx.challenge.count({ where: { featured: true, ...visible } }));
        if (used >= MAX_FEATURED) throw new HttpError(409, 'FEATURED_FULL', 'Only 3 can be featured. Unstar one first.');
      }
      await model.update({ where: { id }, data: { featured } });
      await audit(req.user!, { action: featured ? 'featured.set' : 'featured.unset', targetType: type === 'project' ? 'Project' : 'Challenge', targetId: id, before: { featured: x.featured }, after: { featured } }, tx);
    });
    res.json({ id, featured });
  },
);

const flagshipBody = z.object({ projectId: z.string().min(1) });
router.put(
  '/flagship',
  route(registry, {
    method: 'put',
    path: '/admin/flagship',
    summary: 'Make a project the semester flagship (the previous flagship is unset)',
    guard: 'admin',
    request: { body: flagshipBody },
    responses: { 200: z.object({ projectId: z.string() }), 404: null },
  }),
  async (req, res) => {
    const { projectId } = req.body as z.infer<typeof flagshipBody>;
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK})`;
      const p = await tx.project.findFirst({ where: { id: projectId, ...visible } });
      if (!p) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
      if (p.flagship) return;
      const prev = await tx.project.findMany({ where: { flagship: true }, select: { id: true } });
      await tx.project.updateMany({ where: { flagship: true }, data: { flagship: false } });
      await tx.project.update({ where: { id: projectId }, data: { flagship: true } });
      await audit(req.user!, { action: 'flagship.set', targetType: 'Project', targetId: projectId, before: { flagshipIds: prev.map((x) => x.id) }, after: { flagship: true } }, tx);
    });
    res.json({ projectId });
  },
);

export default router;
