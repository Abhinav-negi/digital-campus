# CS-03 · Staff directory + subjects with teacher allotment
**Reads:** ARCH §2 D7, §3, §11
**Owns:** `server/src/modules/staff/routes.ts`, `server/src/modules/classes/subjects.ts`, `server/test/subjects.test.ts`

## Endpoints
- `GET /staff?q=` (auth, students included so the CR can pick): `{id, name, dept}` of active staff. **No emails.**
- `GET /classes/:id/subjects?termId=` (read).
- `POST /classes/:id/subjects {name, code?, teacherId}` (board) · `PATCH …/subjects/:sid` · `DELETE …/subjects/:sid` (board; blocked if attendance exists → 409).
- On setting or changing `teacherId`: upsert `ClassMember(role teacher)`; remove the old teacher's membership if they teach no other subject here; `notify(teacher, 'subject-allotted', {classId, subjectId, by})`.
- `POST /classes/:id/subjects/:sid/decline` (the allotted teacher only, "Not me"): clear `teacherId`, drop the membership if it was the last subject, notify the CR(s) and the class teacher, audit.

## Done when
- [ ] Tests: the CR adds a subject with Arjun → Arjun's `GET /classes` includes the class + he has a notification; Arjun declines → it's gone + the CR is notified; a plain student → 403 on POST.

## Notes
- Done S05. `allot(tx, subjectId, from, to, by)` in classes/subjects.ts: upserts the teacher's ClassMember, drops the old teacher's if it was their last active-term subject, notifies `subject-allotted` (not for self). CS-06 reuses it.
- "Not me" = `POST …/subjects/:sid/decline` (allotted teacher only) → `subject-declined` to CRs and the class teacher. Past-term subjects → 409 PAST_TERM; delete with attendance → 409 HAS_ATTENDANCE.
- `GET /staff?q=`: active staff `{id, name, dept}`, no emails, any session.
