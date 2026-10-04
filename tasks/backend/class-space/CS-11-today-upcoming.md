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
- Schedule: exported `load` and `present` from `classes/schedule.ts` (no logic change); a teacher's Today calls `load` with one of their classes, which already spans every class sharing a teacher, then filters `teacherId === me`. Cross-class clashes are staff-only: the student view filters `clashWith` to its own class.
- Attendance: extracted the `/me/attendance` handler body into exported `myAttendance(user)` in `attendance/routes.ts` (behaviour unchanged); Today reuses it.
- Staff session = the CS-05 item shape flattened plus `class`, `attendanceDone` (a saved session for the subject today, same slot if any) and `canEdit` (admin, class teacher, or the subject's teacher).
- Upcoming: `days` is 14 or 30 (else 422); staff see exams/deadlines of their own subjects (or any in a class they lead), only their own assignments, and their reminders (PROTO `upcoming()`). Assignment `dueAt` is cut by the institution date. Staff Today uses 7 days.
- `current`/`next` use the institution clock (`HH:MM`), skip `off` items and events; not asserted in tests (time-dependent). Tests build their own slots for today's weekday so they pass on weekends too.
