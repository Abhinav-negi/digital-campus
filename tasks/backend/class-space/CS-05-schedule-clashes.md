# CS-05 · Per-date schedule changes + clash detection
**Reads:** ARCH §2 D10–D11, §3 (cancel/postpone row), §9.3, §11 · PROTO `student.html:539-550` (slotSheet), `teacher.html:190-200` (change badges)
**Owns:** `server/src/modules/classes/{schedule.ts,schedule.math.ts}`, `server/test/schedule.test.ts`

## Endpoints
- `GET /classes/:id/schedule?from=&to=` (read, ≤14 days): per date, the computed items (ARCH §9.3 shape) with `change` info and `clashWith[]`.
- `POST /classes/:id/changes {date, kind, slotId?, subjectId?, title?, start?, end?, room?, movedToDate?, note?}`
  - `cancelled` / `moved`: need a `slotId` that occurs on `date`. A `moved` change needs a new start/end and an optional `movedToDate` (postpone to another day).
  - `extra`: needs a `subjectId`. `event`: needs a `title` (seminar, fest), and the subject is optional.
  - **Who:** board (CR, class teacher) for anything in the class; **a subject teacher only for slots or extras of their own subject** (else 403); admin anything.
- `DELETE /classes/:id/changes/:changeId` (same rule): undo.
- Every write: notify the class (`class-change`, can't be muted) and audit. **If the write creates a clash**, notify every involved teacher (`clash`, payload with both items and links to cancel/postpone).
- `schedule.math.ts` (pure): `daySchedule(slots, changes, date)`, `clashes(items)`, `teacherClashes(itemsAcrossClasses)`. These are reused by CS-11.

## Done when
- [ ] Unit tests: cancel hides; a move hides the original and shows on the target date/time; extra and event add; 13:00/13:00 and 10:00–11:00 vs 10:30 clash; 10:00–11:00 vs 11:00 doesn't; one teacher in two classes clashes; cancelling one clears the clash.
- [ ] API tests: Arjun can't cancel Meera's slot (403); the CR can; the clash notification goes to both teachers.

## Notes
