# ST-10a · Me: profile + your data
**Reads:** SPEC §9.1, §12 · PROTO `student.html:480-508` (rMe: header, profile, my posts) · API CM-01, AD-01 (`DELETE /me`)
**Owns:** `web/src/routes/student/me/{MePage,ProfileForm,YourData}.tsx`

## Do
- The header (avatar xl, name, label, ID, track record); availability tabs + helps-juniors switch + focus date; the profile form; My projects; My board posts.
- Your data: Export (`GET /me/export`) · Delete account (confirm sheet with password → `DELETE /me`).

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] Profile edits show in People; export downloads JSON.

## Notes
