import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { page, pageQuery, paginate } from '../../lib/http.js';
import { registry, route } from '../../lib/openapi.js';

// CS-03: the staff directory the CR picks subject teachers from (D7). No emails: students can read it.

const staffCard = z.object({ id: z.string(), name: z.string(), dept: z.string().nullable() }).meta({ id: 'StaffCard' });

const router = Router();

router.get(
  '/',
  auth(),
  route(registry, {
    method: 'get',
    path: '/staff',
    summary: 'Active staff by name (?q= matches name or dept); no emails',
    guard: 'auth',
    request: { query: pageQuery.extend({ q: z.string().trim().max(100).optional() }) },
    responses: { 200: z.object({ items: z.array(staffCard), nextCursor: z.string().nullable() }) },
  }),
  async (req, res) => {
    const { q, cursor, limit } = req.query as unknown as { q?: string; cursor?: string; limit: number };
    const rows = await db.user.findMany({
      where: {
        role: 'staff',
        status: 'active',
        ...(q && { OR: [{ name: { contains: q, mode: 'insensitive' } }, { dept: { contains: q, mode: 'insensitive' } }] }),
      },
      select: { id: true, name: true, dept: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      ...paginate(cursor, limit),
    });
    res.json(page(rows, limit));
  },
);

export default router;
