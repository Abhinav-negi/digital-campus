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
- Done S05. Move = drop old ClassMember (incl. CR) + upsert new + homeClassId, one transaction, attendance untouched; invited students get a re-sent invite. Overview counts the last 7 days; classesWithoutTimetable = live classes with no slots in the active term (the 18 thin ones on the seed).
