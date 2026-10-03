# AD-03 · Edit student details + move batch
**Reads:** ARCH §2 D2, D4
**Owns:** `server/src/modules/admin/students.ts`, `server/test/admin-students.test.ts`

## Endpoints
- `PATCH /admin/students/:id {name?, studentIdNo?, email?}`: email unique (409); changing the email of an invited user re-sends the invite.
- `POST /admin/students/:id/move {classId}`: change `homeClassId` + the membership; the attendance history stays with the old class; the branch/year label updates. If they were the CR of the old class, remove that.
- All audited with before/after; notify the student.

## Done when
- [ ] Tests: after a move the student sees the new class and loses the old one; the audit has before/after.

## Notes
