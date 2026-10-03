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
