import type { Prisma } from '@prisma/client';
import { db } from './db.js';

/** Bulk-insert one in-app notification per user (ARCH §11). Duplicate ids are collapsed. */
export const notify = async (
  userIds: string[],
  type: string,
  payload: Prisma.InputJsonValue,
  tx: Prisma.TransactionClient = db,
) => {
  // TODO(CS-12): drop users who muted `type` (never for 'class-change') once User has a mute column.
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return { count: 0 };
  return tx.notification.createMany({ data: ids.map((userId) => ({ userId, type, payload })) });
};
