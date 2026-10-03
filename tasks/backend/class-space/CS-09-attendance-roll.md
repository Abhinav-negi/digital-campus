# CS-09 · Attendance: roll, past session, corrections, views
**Reads:** ARCH §3, §9.5 · SPEC §8 · PROTO `data.js:285-302` (**the maths, port exactly**), `teacher.html:204-294`, `:374-385`, `student.html:230-237`
**Owns:** `server/src/modules/attendance/{routes,math}.ts` (roll parts), `server/test/attendance.test.ts`

## Endpoints
- `POST /attendance-sessions {subjectId, date, slotId?}` (teach): open or fetch the session for that subject/date/slot (idempotent). `date` must be today or yesterday (paper days) unless admin. Returns the roster `{id, name, rollNo, avatarSeed}` + the current absentees.
- `PUT /attendance-sessions/:id {absentIds[]}` (teach): upsert every roster row (present = not in absentIds), `savedAt`; **changing an existing row writes AuditLog before/after**; notify a student who drops below the minimum.
- `GET /me/attendance` (student): per subject of the active term `{subject, present, total, pct, min, status, text, history:[{date, present}] (last 12)}`.
- `GET /classes/:id/attendance?subjectId=` (teach): rows sorted lowest first + `belowCount`.
- **The CR and other students → 403** on the session routes.
- `math.ts`: `attendanceSummary(present, total, min)` → `{pct, status, text}`, ported from PROTO verbatim.

## Done when
- [ ] Unit tests port the PROTO cases: 0 sessions → 100%; at the minimum → "Right at the line"; above → "Safe by N class(es)"; below → "Attend the next N".
- [ ] API tests: the CR → 403; a student sees only their own; a correction creates an audit row with before/after.

## Notes
