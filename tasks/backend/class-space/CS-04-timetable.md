# CS-04 · Weekly timetable
**Reads:** ARCH §7 (TimetableSlot), §9.3 · PROTO `student.html:212-213` (week grid), `data.js:304-310`
**Owns:** `server/src/modules/classes/timetable.ts`, `server/test/timetable.test.ts`

## Endpoints
- `GET /classes/:id/timetable?termId=` (read): the base weekly slots, grouped by weekday 1–6, with subject + teacher name.
- `POST /classes/:id/timetable {subjectId, weekday, start, end, room?}` · `PATCH …/:slotId` · `DELETE …/:slotId` (board). `start < end` is validated. **Overlaps are allowed** (D11); the response includes `clashWith[]`.
- `PUT /classes/:id/timetable {slots:[…]}` (board): replace the whole week in one transaction (used by the import apply and "edit week" save). Audited as one entry with a before/after summary.

## Done when
- [ ] Tests: replacing the week is atomic; a student → 403 on writes; an overlapping slot is accepted and reported in `clashWith`.

## Notes
- Done S05. `PUT …/timetable` replaces the week atomically (one bad row → 422, nothing changes; one `timetable.replace` audit). Overlaps are accepted and returned in `clashWith` (slot ids, same weekday, same class). PUT drops old slot ids and their per-date changes (`ponytail:`).
