import { execFileSync } from 'node:child_process';
import request from 'supertest';
import { app } from '../src/app.js';
import { newToken } from '../src/lib/auth.js';
import { db } from '../src/lib/db.js';

// Test harness (FND-08). test/setup.ts has already pointed DATABASE_URL at TEST_DATABASE_URL.
// Files run one at a time (--test-concurrency=1), so a file may `before(resetDb)` without racing another.

/** Truncate every table and re-seed the demo world (prisma/seed.ts, ~1.5s). */
export const resetDb = () => {
  const { SEED_MODE: _, ...env } = process.env;
  execFileSync(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], { cwd: `${import.meta.dirname}/..`, env, stdio: ['ignore', 'ignore', 'inherit'] });
};

/** Seeded users by role (prisma/seed.ts ids). Password for every active account: campus123. */
export const users = {
  student: 's1', // Riya Patel, CSE 2A (c1)
  cr: 's1', // Riya is c1's CR
  teacher: 't1', // Dr. Meera Iyer, c1 class teacher
  subjectTeacher: 't2', // Prof. Arjun Rao, teaches c1/c2/c3 subjects, class teacher of none
  outsider: 't3', // Dr. Sana Khan, teaches c1 + c3, not c2
  admin: 'a1', // the chief, academics@demo.edu
} as const;
export type Role = keyof typeof users;
export const PASSWORD = 'campus123';
export const ORIGIN = new URL(process.env.APP_URL!).origin;

/**
 * A supertest agent logged in as `who` (a role or any seeded email) via a Bearer session.
 * The session is written straight to the DB: no scrypt, no login rate limit, no CSRF Origin needed.
 * Login itself is covered in auth.test.ts.
 */
export const agent = async (who: Role | (string & {})) => {
  const user = await db.user.findUniqueOrThrow({ where: who in users ? { id: users[who as Role] } : { email: who.toLowerCase() } });
  const { token, tokenHash } = newToken();
  await db.loginSession.create({ data: { userId: user.id, tokenHash, userAgent: 'test', expiresAt: new Date(Date.now() + 86_400_000) } });
  return Object.assign(request.agent(app).auth(token, { type: 'bearer' }), { user, token });
};
