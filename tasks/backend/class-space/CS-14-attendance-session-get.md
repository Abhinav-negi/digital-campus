# CS-14 · GET one attendance session
**Reads:** ARCH §9.5 · API CS-09 · `server/src/modules/attendance/` (find the PUT handler)
**Owns:** the attendance sessions route file in `server/src/modules/attendance/` + its test; `web/src/routes/teacher/queries.ts` (`openedSessions` stash) and `web/src/routes/teacher/attendance/AttendancePage.tsx`

## Do
- `GET /attendance-sessions/:id` → the same `AttendanceSession` shape `POST`/`PUT` return (roster + absentIds), same guard as `PUT`.
- `npm run gen:api`; the attendance page loads by id with a query, and the `openedSessions` map goes away.

## Done when
- [ ] Reloading `/t/attend/:id` shows the roster (no redirect to Today); a teacher without the class gets 403/404 (test).

## Notes
- Origin: TE-02 (S10). The page only gets a session id; without this GET it read a module-level stash, so reload/deep links redirect to `/t`.
