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
- Built edit/{EditToggle,BoardForms,History,TipSheet}.tsx; ClassPage owns `editing` + first-time tip (localStorage `dc.cr-tip`), Board takes `editing` and shows add/remove on Notices, Exams, Deadlines, Files (timetable/syllabus editing = ST-03b/c).
- BoardForms exports `AddBoardSheet`, `useRemoveItem`, and `AddToBoardSheet({classId, post:{id,title,kind?,dueAt?}, onClose})` (POST /board/from-post) for ST-06.
- TipSheet buttons all just call `onPick(kind)`; ClassPage's handler turns editing on and closes. ST-03b/c/ST-05 must route there.
- Verified with curl on :4103 (CR s1, class c1): add+delete notice and exam, history shows create+delete for both. Not browser-tested (QA-03). No new unit test (no pure logic worth it). typecheck + web tests pass.
