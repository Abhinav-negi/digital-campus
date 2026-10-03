# AF-03 · Classes: every batch
**Reads:** ARCH §10 (admin reuses the teacher view) · API CS-01 `GET /classes?all=1`
**Owns:** `web/src/routes/admin/classes/*`

## Do
- All classes grouped by branch → year, with health flags (no timetable, no CR, invites pending); filters; archived toggle.
- Clicking opens `/a/classes/:id` = TE-05 `ClassView` in `adminMode` (don't duplicate screens).
- Create a class on behalf of a teacher (TE-07 wizard + a class teacher picker).

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] The admin edits any class board and corrects an attendance row; both appear in Audit.

## Notes
