# AF-03 · Classes: every batch
**Reads:** ARCH §10 (admin reuses the teacher view) · API CS-01 `GET /classes?all=1`
**Owns:** `web/src/routes/admin/classes/*`

## Do
- All classes grouped by branch → year, with health flags (no timetable, no CR, invites pending); filters; archived toggle.
- Clicking opens `/a/classes/:id` = TE-05 `ClassView` in `adminMode` (don't duplicate screens).
- Create a class on behalf of a teacher (TE-07 wizard + a class teacher picker).

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] The admin edits any class board and corrects an attendance row; both appear in Audit.

## Notes
- Routes (admin/routes.ts): `classes` List, `classes/new` New (TE-07 `NewClass` now exported with optional `base`/`teacher` props; admin hands the class over via POST /classes/:id/handover after create), `classes/:id/correct`, `classes/:id/*` = ClassView adminMode.
- Attendance correction: ClassView's attendance tab is still TE-05b "soon", so admin reaches it via a "Correct attendance" link on each list card -> `/a/classes/:id/correct` (subject + date -> POST /attendance-sessions -> existing TE-02 page at /t/attend/:id; its back link goes to /t). Suggested later ClassView tweak (TE-05b lane): in adminMode link the Attendance tab to `/a/classes/:id/correct`.
- Health flags: ClassCard has no timetable count, so "No timetable" = counts.subjects == 0. List is one page of 100 classes (ponytail).
- Live check (port 3142, admin a1, class c1): board create+update+delete and attendance PUT correction all appeared in GET /admin/audit (board.notice.create/update/delete, attendance.correct). Reverted: item deleted, test session removed. UI not browser-tested.
- Checks: typecheck, web tests, web build pass.
