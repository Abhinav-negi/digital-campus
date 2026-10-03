import type { Prisma } from '@prisma/client';
import { db } from './db.js';

type Entry = {
  action: string;
  classId?: string;
  targetType: string;
  targetId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
};

/** One AuditLog row (ARCH §3). Pass `tx` inside `db.$transaction` so the log commits with the change. */
export const audit = (actor: { id: string }, entry: Entry, tx: Prisma.TransactionClient = db) =>
  tx.auditLog.create({ data: { actorId: actor.id, ...entry } });
