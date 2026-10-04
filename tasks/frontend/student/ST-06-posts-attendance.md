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
