import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../../lib/audit.js';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { notify } from '../../lib/notify.js';
import { registry, route } from '../../lib/openapi.js';
import { isDeleted } from './users.js';

// AD-02: the admin badge (D1). Mounted under /admin, behind admin(), so any admin may grant or revoke.

const body = z.object({ isAdmin: z.boolean() });

const router = Router();

router.put(
  '/users/:id/admin',
  route(registry, {
    method: 'put',
    path: '/admin/users/:id/admin',
    summary: "Grant or revoke the admin badge (staff only; the chief's badge stays)",
    guard: 'admin',
    request: { params: z.object({ id: z.string().min(1) }), body },
    responses: { 200: z.object({ id: z.string(), isAdmin: z.boolean() }), 404: null, 409: null },
  }),
  async (req, res) => {
    const { isAdmin } = req.body as z.infer<typeof body>;
    const target = await db.user.findUnique({ where: { id: req.params.id as string } });
    if (!target || isDeleted(target)) throw new HttpError(404, 'NOT_FOUND', 'User not found');
    if (target.role !== 'staff') throw new HttpError(422, 'NOT_STAFF', 'Only staff can be admins');
    // The chief is always an admin, so "revoke your own badge only if another admin exists" always holds once this passes.
    if (target.isChief && !isAdmin) throw new HttpError(409, 'CHIEF', "The chief admin's badge cannot be removed");
    if (target.isAdmin !== isAdmin)
      await db.$transaction(async (tx) => {
        await tx.user.update({ where: { id: target.id }, data: { isAdmin } });
        await audit(req.user!, { action: `user.admin.${isAdmin ? 'grant' : 'revoke'}`, targetType: 'User', targetId: target.id, before: { isAdmin: target.isAdmin }, after: { isAdmin } }, tx);
        await notify([target.id], 'admin-badge', { isAdmin, by: req.user!.name }, tx);
      });
    res.json({ id: target.id, isAdmin });
  },
);

export default router;
