# TE-05b · Class detail: Students + Attendance tabs
**Reads:** PROTO `teacher.html:362-386`, `:150-167`, `:502-510` (paste sheet + dry run) · API CS-02, CS-09
**Owns:** `web/src/routes/teacher/class/{StudentsTab,AttendanceTab}.tsx`

## Do
- Students: the roster sorted by ID, CR badge, Invited/Active, Resend, Make CR, Remove, Add students (paste sheet with the dry-run preview).
- Attendance: a subject chip switcher, lowest first, below-minimum badges.
- Both honour TE-05a's `adminMode`.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] Make CR → the CR's phone shows Edit (SPEC §15 step 2); added students get an invite email.

## Notes
- Built StudentsTab/AttendanceTab, wired in ClassView; hooks appended to teacher/queries.ts; reuses `localPreview` from NewClass (already exported) + server dry-run per keystroke.
- Make CR sends PUT /cr with [newest current CR, new student] (API replaces the set, max 2). Only active students get the button (PROTO); Resend only for invited. Remove uses window.confirm.
- Attendance subjects: class teacher/admin see all subjects, subject teacher only those where teacher.id = me (GET /classes/:id/subjects).
- Live (t1/c1, port 3141): PUT /cr [s1,s2] -> s2 GET /classes/c1 myRole "cr" (UI Edit keys off this); restored to [s1]. Invite apply logged [mail] to=...; test user TEST900 removed and deleted. GET /attendance?subjectId=sub1 returns rows/belowCount as UI reads.
- Checks: typecheck, web tests (14), build pass.
