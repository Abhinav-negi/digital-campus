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
- Done: ClassView (adminMode prop; Component export mounts it at /t/classes/:id/*), BoardTab (reuses student Board/EditToggle/History/Subjects/WeekEditor/WeekAhead/Import, edit controls for class teacher/admin), PostsTab (GET /classes/:id/posts filtered to my author id; admin sees all; seen bar from `stats`; POST /posts/:id/remind). Hooks useClassPosts/useRemind appended to teacher/queries.ts.
- Students, Attendance tabs are placeholders naming TE-05b; Settings (class teacher/admin only) names TE-06. AF-03 should mount `<ClassView adminMode />` at /a/classes/:id/*; tab links use absolute /t|/a/classes/:id/<tab>.
- Gotcha: student EditToggle text says "as CR" (cosmetic; a `label` prop would fix). Board empty states say "The CR will add..." even for the class teacher.
- Live (port 3141, c1/Meera Iyer): board POST 201, PATCH 200, history logged; POST /posts then remind -> {reminded:28}, notifications rows for s1,s2 type post. typecheck, web tests (14), build pass.

