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
