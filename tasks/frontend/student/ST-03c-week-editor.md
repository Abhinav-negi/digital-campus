# ST-03c · CR edit: weekly timetable editor
**Reads:** ARCH §2 D11, §9.3 · API CS-04
**Owns:** `web/src/routes/student/class/edit/WeekEditor.tsx`

## Do
- A grid of slots per weekday; add/edit/delete slots (subject, start, end, room).
- Overlaps are allowed and shown with a Clash badge.
- Save → `PUT /classes/:id/timetable`.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] From an empty class: subjects (ST-03b) → timetable → an exam (ST-03a), and the slots show on Board and Today.

## Notes
- Done. `WeekEditor.tsx` edits a local draft of the week (loaded from `GET /timetable`); one "Save timetable" does `PUT /classes/:id/timetable` (whole week, replaces).
- Clash badge is computed on the draft (`clashes()`, same maths as ARCH 9.3); overlaps never block. Slot form is a Sheet (subject, day, start, end, room); start >= end is refused in the form.
- Wired in `ClassPage.tsx` beside `<Subjects>` (CR edit mode, latest term); TipSheet "Timetable" turns on edit mode and scrolls to `#week-editor`.
- Save invalidates `['classes', id]` and `['me']`, so Board and Today refresh. Unsaved draft is lost if edit mode is toggled off (ponytail: no dirty guard).
- Test: `weekEditor.test.ts` (clash maths). Live API check done on c-cse1 (subject, overlapping PUT, exam, schedule, /me/today).
- S11 orchestrator: live curl verified on c-cse1 (subject → overlapping slots with clashWith → exam → board/schedule/today). Leaves a 00:00–23:00 test slot on c-cse1 (reseed clears).
