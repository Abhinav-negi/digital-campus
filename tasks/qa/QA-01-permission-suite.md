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
