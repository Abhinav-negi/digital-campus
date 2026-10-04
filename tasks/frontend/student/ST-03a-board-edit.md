# ST-03a · CR edit: toggle, board forms, history, tip sheet
**Reads:** ARCH §2 D7, §3 · PROTO `student.html:204-206`, `:216`, `:223` (edit history), `:520-538` (addBoard forms), `:558-566` (toBoard) · API CS-07
**Owns:** `web/src/routes/student/class/edit/{EditToggle,BoardForms,History,TipSheet}.tsx`

## Do
- Edit toggle ("Editing is on. Every change is logged.") → add/remove buttons on each Board section.
- The PROTO forms for notice, exam, deadline and file (file uses presign upload).
- "Add to board" on teacher posts (used by ST-06's post sheet).
- An edit history card (last 6).
- First-time CR tip sheet (SPEC §6): "Fill in the timetable, then the syllabus, then exam dates", with a button for each and an **Import** shortcut (ST-05).

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] The CR adds and removes a notice and an exam; both show in the history card.

## Notes
