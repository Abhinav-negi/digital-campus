# ST-03 · CR edit mode: board, subjects + teacher picker, weekly timetable
**Reads:** ARCH §2 D7, §3 · PROTO `student.html:204-206` (edit toggle/add/del buttons), `:216`, `:223` (edit history), `:520-538` (addBoard forms), `:558-566` (toBoard) · API CS-03, CS-04, CS-07
**Owns:** `web/src/routes/student/class/edit/{EditToggle,BoardForms,Subjects,WeekEditor}.tsx`

## Do
- Edit toggle ("Editing is on. Every change is logged.") → add/remove buttons on each section; the PROTO forms for notice, exam, deadline and file (file uses presign upload).
- **Subjects manager**: list + add/edit (name, code, **teacher picker** searching `GET /staff`; shows "Arjun Rao will be notified"); a removed or declined teacher shows "No teacher yet".
- **Weekly timetable editor**: a grid of slots per weekday, add/edit/delete slots (subject, start, end, room); overlaps allowed and shown with a Clash badge; Save → `PUT /classes/:id/timetable`.
- "Add to board" on teacher posts (from ST-06's post sheet).
- An edit history card (last 6).
- First-time CR tip sheet (SPEC §6): "Fill in the timetable, then the syllabus, then exam dates", with buttons for each and an **Import from PDF** shortcut (ST-05).

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] The CR can build a class from empty: subjects with teachers → timetable → an exam, and the teacher sees the class appear.

## Notes
