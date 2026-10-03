# FND-08 · Test harness
**Reads:** ARCH §5 (tests), §15
**Owns:** `server/test/helpers.ts`, `server/test/auth.test.ts`

## Goal
Every later backend task can write a permission test in a few lines.

## Do
- `helpers.ts`: point Prisma at `TEST_DATABASE_URL`; `resetDb()` (truncate all + run the seed); `agent(role | userEmail)` → a supertest agent already logged in (`'student'`=Riya, `'cr'`=Riya, `'teacher'`=Meera, `'subjectTeacher'`=Arjun, `'outsider'`=Sana on a class she doesn't teach, `'admin'`=chief).
- `auth.test.ts`: login/logout, Bearer, disabled user, and the wall smoke test.

## Done when
- [ ] `npm test -w server` runs green in under 30s.

## Notes
- Done S05. `test/setup.ts` (`--import`ed first) points `DATABASE_URL` at `TEST_DATABASE_URL` and sets `NODE_ENV=test`; it refuses if they're equal. Files run serially (`--test-concurrency=1`): a reset truncates with CASCADE. 31 tests in ~7s.
- `agent(role | email)` writes a `LoginSession` directly and returns a Bearer supertest agent (+ `.user`, `.token`): no scrypt, no rate limit, no Origin needed. Roles: student/cr = s1 Riya, teacher = t1 Meera, subjectTeacher = t2 Arjun, outsider = t3 Sana (not on c2), admin = a1.
- `resetDb()` runs `prisma/seed.ts` as a child process (its top-level code disconnects the client). Convention: `before(resetDb); after(() => db.$disconnect());` in files that need the pristine seed.
