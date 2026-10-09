# QA-01 · Permission suite (the wall, end to end)
**Reads:** ARCH §3 (the whole table), §15
**Owns:** `server/test/wall.test.ts`

## Goal
One table-driven test that walks **every route in openapi.json** × every role and asserts the ARCH §3 matrix. This is the gate before any frontend wave is called done.

## Do
- Load the OpenAPI paths; for each, a role → expected status map (default deny). Roles: student, CR, subject teacher, class teacher, outsider teacher, admin, banned student, disabled user.
- Assert: teacher → 403 on every `/commons/*`; admin → never 403; CR → 403 on attendance writes; student → 403 on other students' attendance; admin writes create AuditLog rows.

## Done when
- [ ] Green, and adding a new route without a matrix entry fails the test.

## Notes
- `server/test/wall.test.ts`: MATRIX (route -> allowed roles) x 9 roles (+anon) over `openApiDocument().paths`; default deny = 403, no/disabled session = 401, allowed = not 401/403. A route missing from MATRIX (or a stale entry) fails the first test: it already caught `POST /admin/commons/{type}/{id}/hide` added by a parallel task.
- Gotchas: class routes use c2 (class teacher t4, CR s31, t2 owns sub7, t3 outsider, s2 outsider student, s33 banned in before()). Denies run before allows because allowed calls like graduate really mutate. Handler-enforced roles (attendance, changes, checkin) have valid bodies in INPUT so the 403 comes from the wall, not 422.
- Admin is deliberately 403 on student-only routes (`/checkin`, `/me/attendance`, `/me/profile`, posts seen, and message/join/like in the Commons: `studentOnly`); that is stricter than ARCH, not a violation. DELETE /me: chief gets 409.
- No wall violations found. Ran on campus_test_b: full server suite 177/177, `npm run typecheck -w server` clean.
