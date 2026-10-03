# TE-05 · Class detail: Board · Posts · Students · Attendance
**Reads:** PROTO `teacher.html:316-385` · API CS-07 (board + history), CS-08, CS-02, CS-09 · ARCH §10 (admin reuses this view)
**Owns:** `web/src/routes/teacher/class/{ClassView,BoardTab,PostsTab,StudentsTab,AttendanceTab}.tsx`

## Do
- The header (term · minimum %, name, role line, New post) + tabs (Settings only for the class teacher or admin).
- Board: read-only with "The CR (Riya) maintains the board", plus Edit history. **The class teacher and admin also get the edit controls** (reuse ST-03 components).
- Posts: my posts with the seen bar + Remind.
- Students: the roster sorted by ID, CR badge, Invited/Active, Resend, Make CR, Remove, Add students (paste sheet with the dry-run preview, PROTO `:150-167`, `:502-510`).
- Attendance: a subject chip switcher, lowest first, below-minimum badges.
- **Admin mode** (`/a/classes/:id` renders this with `adminMode`): every tab editable, plus the class teacher reassignment in Settings.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] Make CR → the CR's phone shows Edit (SPEC §15 step 2).

## Notes
