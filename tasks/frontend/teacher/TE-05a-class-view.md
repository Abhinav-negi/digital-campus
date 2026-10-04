# TE-05a · Class detail: shell, Board, Posts
**Reads:** PROTO `teacher.html:316-361` · API CS-07 (board + history), CS-08 · ARCH §10 (admin reuses this view)
**Owns:** `web/src/routes/teacher/class/{ClassView,BoardTab,PostsTab}.tsx`

## Do
- The header (term · minimum %, name, role line, New post) + tabs Board · Posts · Students · Attendance (+ Settings only for the class teacher or admin).
- Board: read-only with "The CR (Riya) maintains the board", plus Edit history. The class teacher and admin also get the edit controls (reuse ST-03 components).
- Posts: my posts with the seen bar + Remind.
- An `adminMode` prop (`/a/classes/:id`): every tab editable.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] The class teacher edits the board; Remind sends a notification.

## Notes
