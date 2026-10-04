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
- Done S05. Pure maths in `schedule.math.ts` (`daySchedule`, `clashes`, `teacherClashes`; types `Slot`, `Change`, `Item`): CS-11 imports these. The DB loader `load()` in schedule.ts isn't exported yet; export it for Today's cross-class view.
- Cancelled/moved slots stay in the list with `off: true` + `change` (badges, undo) and never clash. Item id = slot id, or the change id for extra/event/moved. A new cancel/move replaces the previous one for the same slot and date.
- `clashWith` items name the other class; includes the same teacher in another class. Clash notifications come from a before/after diff on the affected dates (both teachers, including the actor); class-change notifications skip the actor. Timetable writes don't notify clashes.
- Orchestrator: the own-subject check also requires `classId` (defence in depth).
