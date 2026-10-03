# CS-07 · Class board items + edit history
**Reads:** ARCH §3, §7 (BoardItem) · SPEC §7.1 · PROTO `student.html:207-225` (board), `:520-538` (addBoard), `:558-566` (toBoard), `teacher.html:333-348`
**Owns:** `server/src/modules/classes/board.ts`, `server/test/board.test.ts`

## Endpoints
- `GET /classes/:id/board?termId=` (read): `{notices, exams, deadlines, syllabus, files}`, each sorted (pinned notices first, dated items by date). **Empty sections return `[]`; the web shows the D9 placeholders.**
- `POST /classes/:id/board {kind, title, body?, subjectId?, date?, pinned?, units?, fileKey?, fileName?}` (board) · `PATCH …/:itemId` · `DELETE …/:itemId`. Every write audited with before/after; new exams and deadlines notify the class.
- `POST /classes/:id/board/from-post {postId, kind: exam|deadline, title, date, subjectId?}` (board): the CR turns a teacher post into a board item.
- `GET /classes/:id/history?limit=` (board or own, admin): audit rows for the class (who, what, when).
- File items return a `presignGet` URL.

## Done when
- [ ] Tests: the CR creates, edits and deletes with an audit row each; a student → 403; a teacher who is a member can read but not edit unless class teacher.

## Notes
