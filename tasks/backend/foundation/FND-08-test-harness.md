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
