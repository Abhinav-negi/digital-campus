# CS-08 · Teacher posts: multi-class, seen, remind
**Reads:** SPEC §7.2 · PROTO `teacher.html:350-360` (seen bar + remind), `:427-438` (composer), `student.html:226-229`, `:551-557`
**Owns:** `server/src/modules/posts/routes.ts`, `server/test/posts.test.ts`

## Endpoints
- `POST /posts {kind: announcement|assignment, title, body, classIds[], dueAt?, fileKey?, fileName?}` (staff; must teach in **every** target class, or admin). Notify the students of each class.
- `GET /classes/:id/posts` (read): newest first; for students each has `seen: bool`; for teachers `{seen, total}` per class.
- `POST /posts/:id/seen` (student, idempotent).
- `POST /posts/:id/remind` (the author or admin): notify the unseen students → `{reminded:n}`.
- `GET /posts/mine` (staff): my posts with seen rates across targets.
- Assignments feed Upcoming (CS-11).

## Done when
- [ ] Tests: one post to 2 classes is visible in both; seen counts; remind hits only the unseen; a teacher not in a class → 403 when targeting it.

## Notes
