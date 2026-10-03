import { PrismaClient } from '@prisma/client';

/** The one Prisma client. Lazy: no connection until the first query. */
export const db = new PrismaClient();
