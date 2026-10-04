import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../../config.js';
import { addDays } from '../../lib/dates.js';
import { db } from '../../lib/db.js';
import { page, pageQuery, paginate } from '../../lib/http.js';
import { registry, route } from '../../lib/openapi.js';
import { institutionOf } from './school.js';

// AD-08: the audit log (ARCH §3), newest first. Mounted under /admin, behind admin().

const auditEntry = z
  .object({
    id: z.string(),
    action: z.string(),
    actor: z.object({ id: z.string(), name: z.string() }),
    class: z.object({ id: z.string(), name: z.string() }).nullable(),
    targetType: z.string(),
    targetId: z.string(),
    detail: z.string(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'AuditEntry' });

const auditQuery = pageQuery.extend({
  actorId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  /** Prefix match: `student` finds `student.update` and `student.move`. */
  action: z.string().trim().min(1).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

/** UTC instant of 00:00 on `date` (a UTC-midnight calendar date, lib/dates) in `tz`. */
// ponytail: offset sampled at UTC midnight, so a DST jump right at local midnight is off by an hour; fine for India.
const startOfDay = (date: Date, tz = config.INSTITUTION_TZ) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(date)
      .map((x) => [x.type, Number(x.value)]),
  );
  const offset = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour, p.minute, p.second) - date.getTime();
  return new Date(date.getTime() - offset);
};

// --- detail: a one-line summary of before/after, never a JSON dump ---
const MAX = 60;
const cut = (s: string) => (s.length > MAX ? `${s.slice(0, MAX - 1)}…` : s);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const fmt = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) {
    if (v.length === 0) return 'none';
    if (v.every((x) => typeof x !== 'object')) return cut(v.slice(0, 3).join(', ') + (v.length > 3 ? ` +${v.length - 3} more` : ''));
    return `${v.length} items`;
  }
  if (isObj(v)) return typeof v.name === 'string' ? cut(v.name) : `${Object.keys(v).length} fields`;
  return cut(String(v));
};
const words = (k: string) => k.replace(/Id$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

const describe = (action: string, before: unknown, after: unknown) => {
  const label = action.replace(/[._-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
  let changes: string[];
  if (isObj(before) || isObj(after)) {
    const b = isObj(before) ? before : {};
    const a = isObj(after) ? after : {};
    const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
    changes = keys
      .filter((k) => !(k in b && k in a) || JSON.stringify(b[k]) !== JSON.stringify(a[k]))
      .map((k) => (k in b && k in a ? `${words(k)} ${fmt(b[k])} → ${fmt(a[k])}` : `${words(k)} ${fmt(k in a ? a[k] : b[k])}`));
  } else if (before == null && after == null) changes = [];
  else changes = [`${fmt(before)} → ${fmt(after)}`];
  return [label, ...changes.slice(0, 4)].join(' · ');
};

const router = Router();

router.get(
  '/audit',
  route(registry, {
    method: 'get',
    path: '/admin/audit',
    summary: 'The audit log, newest first; filter by actor, class, action prefix and from/to dates (institution time zone)',
    guard: 'admin',
    request: { query: auditQuery },
    responses: { 200: z.object({ items: z.array(auditEntry), nextCursor: z.string().nullable() }) },
  }),
  async (req, res) => {
    const { actorId, classId, action, from, to, cursor, limit } = req.query as unknown as z.infer<typeof auditQuery>;
    const createdAt: Prisma.DateTimeFilter = {
      ...(from && { gte: startOfDay(new Date(from)) }),
      ...(to && { lt: startOfDay(addDays(new Date(to), 1)) }),
    };
    const rows = await db.auditLog.findMany({
      where: {
        actorId,
        classId,
        actor: { institutionId: await institutionOf(req.user!.id) },
        ...(action && { action: { startsWith: action } }),
        ...((from || to) && { createdAt }),
      },
      include: { actor: { select: { id: true, name: true } }, class: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...paginate(cursor, limit),
    });
    const p = page(rows, limit);
    res.json({
      items: p.items.map((r) => ({
        id: r.id,
        action: r.action,
        actor: r.actor,
        class: r.class,
        targetType: r.targetType,
        targetId: r.targetId,
        detail: describe(r.action, r.before, r.after),
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor: p.nextCursor,
    });
  },
);

export default router;
