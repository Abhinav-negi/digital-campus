# ST-06 · Class: Posts + My attendance
**Reads:** SPEC §7.2, §8 · PROTO `student.html:226-237`, `:551-557` (post sheet + seen) · API CS-08, CS-09, CS-10
**Owns:** `web/src/routes/student/class/{Posts,MyAttendance,PostSheet,CheckIn}.tsx`

## Do
- Posts list (New/Seen states, due chips); the post sheet marks it seen; the CR sees "Add to board".
- My attendance: a card per subject (%, bar, "x of y · minimum m%", status text, last-12 dots); the footnote "Only you can see yours."
- **Check-in**: when a code session is open for the student, show a "Enter class code" card (Today + this tab) → `POST /checkin` → "You're marked present".

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] Opening a post updates the teacher's seen count; check-in during a live code session marks present.

## Notes
- Done. Posts/PostSheet/MyAttendance/CheckIn in `routes/student/class/`; ClassPage swaps the two placeholders (attendance tab = CheckIn + MyAttendance); Today renders `<CheckIn />` first in the stack.
- Deviation: no API tells a student a code session is open (`codeOpen` is teacher-only), so the "Enter class code" card is always shown; wrong/expired shows the server message inline. Follow-up if wanted: a `codeOpen` flag on `/me/today`.
- Opening a post calls `POST /posts/:id/seen` from a `useEffect` in PostSheet (only if `seen` is false), then invalidates `['classes',id,'posts']` and `['me','today']`. The post list rows are `<button class="card click">`.
- `/me/attendance` is filtered to the student's home class; dots come from `history` (last 12, already trimmed by the API).
- CR "Add to board" swaps the sheet content to the existing `AddToBoardSheet` (BoardForms) rather than stacking two sheets.
- Verified live (port 3101): seen 1→2 on teacher `/posts/mine`; wrong code 422 BAD_CODE; correct code returns sessionId and teacher poll shows `checkedIn:["s3"]`.
- S10 orchestrator: accepted; check-in card always visible until CS-15 adds a codeOpen flag.
