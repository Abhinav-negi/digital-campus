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
- Done. `me/MePage.tsx` (header, sections), `ProfileForm.tsx` (availability tabs + helps switch + focus date save on change; profile form via `PATCH /me/profile`; exports `parseSkills`), `YourData.tsx` (export via `GET /me/export` -> Blob download; delete via FormSheet password -> `DELETE /me` -> /login).
- Profile comes from `GET /commons/profiles/{me.id}` (query key `['commons','profile',id]`, set from the PATCH response); People lists are invalidated on save, so edits show there.
- ST-10b: add Messages + Notifications `<Sec>`s in MePage where the comment marks it (before "Your data").
- My projects = the profile's `projects` chips (no richer endpoint for "mine"). My board posts = first 50 live `/commons/board-posts` filtered by author id (ponytail: add a `mine` filter server-side if it matters).
- Delete-password field uses `type: 'password' as 'text'` because FormSheet's Field type lacks 'password'; a one-line ui/ change would remove the cast.
- Header omits the student ID (not in PersonProfile). People.tsx untouched; nothing reused from it (its pieces are file-private and the Me layout differs).
- S10 orchestrator: live curl verified (s5 edit visible to s6 in People; export is JSON attachment). FormSheet gained a 'password' field type (cast removed). My-board-posts limit tracked as CM-09.
