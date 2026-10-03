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
