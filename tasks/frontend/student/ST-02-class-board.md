# ST-02 · Class: Board (read)
**Reads:** SPEC §7.1 · ARCH §2 D9 · PROTO `student.html:196-225` (rClass + bBoard read parts) · API CS-07, CS-04, CS-05, CS-01 (terms)
**Owns:** `web/src/routes/student/class/{ClassPage,Board}.tsx`

## Do
- The class header (term eyebrow, name, "You are the CR" chip, class teacher) + tabs Board · Posts · My attendance.
- Board sections: Notices (pinned first), Timetable (5–6 day week grid with today highlighted; changes shown for this week), Exams, Deadlines, Syllabus (units + file chip, opens a presigned URL), Files.
- **Every empty section → a `<CrWillAdd>` placeholder.**
- A term switcher (past terms read-only) when more than one term exists.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] Parity with the prototype board; the past-term switcher shows old data read-only.

## Notes
- S08 ✅ Class = the first `me.classes` entry with role ≠ teacher. Current week comes from `/schedule` (shows changes), past terms from `/timetable`. Saturday shows only if it has slots.
- `fileUrl` is used directly (presign is upload-only). The chips read Today/Tomorrow/In N days (approximates PROTO `DC.rel`). Posts/My attendance are `Empty` placeholders for ST-06. Not checked visually yet (QA-03).
