# CS-11 · Today, Upcoming, reminders
**Reads:** SPEC §7.3, §7.4 · ARCH §9.3 · PROTO `student.html:147-177`, `teacher.html:178-202`, `:440-463`, `data.js:304-321`
**Owns:** `server/src/modules/me/{today,upcoming,reminders}.ts`, `server/test/today.test.ts`

## Endpoints
- `GET /me/today` (one shape per role):
  - student: `{date, cancelled[], current?, next?, items[] (today's schedule from CS-05 math), attendance[] (CS-09 summaries), upcoming[] (14d), unreadPosts[], empty:{timetable:bool, subjects:bool}}`. `empty` drives the D9 placeholders.
  - staff: `{date, sessions[] (across all allotted subjects: item + class + attendanceDone + clashWith + canEdit), upcoming[] (7d)}`.
- `GET /me/upcoming?days=14|30`: exams and deadlines (board) + assignments (posts) + **private reminders (staff)**, sorted, with `kind` and `classId`; the teacher filter matches PROTO `upcoming()`.
- `GET/POST/DELETE /me/reminders` (staff, private).

## Done when
- [ ] Tests: the student Today shows today's cancelled slot + the clash; the teacher Today unions classes and flags the cross-class clash; upcoming windows filter correctly; a reminder is invisible to others.

## Notes
