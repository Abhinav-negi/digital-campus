# AD-04 · School setup: institution + branches
**Reads:** ARCH §2 D2 · SPEC §5 (branches are data)
**Owns:** `server/src/modules/admin/school.ts`, `server/test/admin-school.test.ts`

## Endpoints
- `GET/PATCH /admin/institution {name, timezone}`.
- `GET/POST/PATCH /admin/branches {code, name}`; `DELETE` only if no class uses it (409 otherwise).
- `GET /branches` (public to any authenticated user) for pickers.

## Done when
- [ ] Tests: deleting a used branch → 409; a new branch appears in the class-create picker.

## Notes
- Done S05. `institutionOf(userId)` exported from admin/school.ts; branch codes uppercased, duplicate → 409 BRANCH_EXISTS. `GET /branches` (any session) = `branchesRouter`, mounted in app.ts by the orchestrator.
