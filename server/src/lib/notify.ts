import type { Prisma } from '@prisma/client';
import { db } from './db.js';

/** Bulk-insert one in-app notification per user (ARCH §11). Duplicate ids are collapsed. */
export const notify = async (
  userIds: string[],
  type: string,
  payload: Prisma.InputJsonValue,
  tx: Prisma.TransactionClient = db,
) => {
  let ids = [...new Set(userIds)];
  if (type !== 'class-change' && ids.length) {
    // Muted types are skipped; class changes always get through (ARCH §11).
    const muted = await tx.user.findMany({ where: { id: { in: ids }, mutedTypes: { has: type } }, select: { id: true } });
    const skip = new Set(muted.map((u) => u.id));
    ids = ids.filter((id) => !skip.has(id));
  }
  if (ids.length === 0) return { count: 0 };
  return tx.notification.createMany({ data: ids.map((userId) => ({ userId, type, payload })) });
};
