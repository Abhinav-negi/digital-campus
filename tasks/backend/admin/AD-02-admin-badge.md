# AD-02 · Admin badge (grant / revoke)
**Reads:** ARCH §2 D1
**Owns:** `server/src/modules/admin/badge.ts`, `server/test/admin-badge.test.ts`

## Endpoints
- `PUT /admin/users/:id/admin {isAdmin: bool}` (any admin). Staff only (a student → 422). **The chief's badge can't be removed** (409). An admin may remove their own badge only if another admin exists.
- Audited and notifies the user.

## Done when
- [ ] Tests: grant → the user passes `admin()`; revoking the chief → 409; granting to a student → 422.

## Notes
- Done S05. `PUT /admin/users/:id/admin`; notification type `admin-badge`. Self-revoke needs no check: the chief always keeps the badge.
