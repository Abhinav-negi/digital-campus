# AD-01 · Users directory + staff invites + account control
**Reads:** ARCH §2 D1–D3, §3 · PROTO `admin.html:75-84`
**Owns:** `server/src/modules/admin/users.ts`, `server/test/admin-users.test.ts`
> All routes `/admin/*` behind `admin()`. Every write is audited.

## Endpoints
- `GET /admin/users?q=&role=&branchId=&classId=&status=&cursor=`: everyone, with role, admin/chief flags, status, home class, last login.
- `POST /admin/staff-invites {name, email, dept}` → creates an invited staff User + an Invite (FND-05). Re-post = resend.
- `PATCH /admin/users/:id/status {status: active|disabled}` (the chief can't be disabled). Disabling revokes all of their LoginSessions.
- `POST /admin/users/:id/reset-password` → emails a reset link (FND-04 flow).
- `DELETE /admin/users/:id`: SPEC §12 deletion. Attendance stays and the name is anonymised ("Deleted student"); Commons content is removed. Shared as `deleteUser(id, actor)`.
- `DELETE /me {password}` (any non-chief user): self-delete via the same `deleteUser` (SPEC §12).

## Done when
- [ ] Tests: a non-admin → 403; a disabled user's session is rejected immediately; the chief can't be disabled (409).

## Notes
