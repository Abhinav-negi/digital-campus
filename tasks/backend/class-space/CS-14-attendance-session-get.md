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
- Done: `GET /attendance-sessions/:id` uses `loadSession` (same guard as PUT, incl. today/yesterday limit for non-admins) + the shared `view` presenter. Test added at the end of `server/test/attendance.test.ts`.
- Web: `useAttendanceSession(id)` (key `['attendance-session', id]`, `gcTime: 0` so each open is fresh) replaces `openedSessions`; `AttendancePage` splits into a loader (`Component`) and `Page`, which gets `absent` initial state from loaded data. Error (403/404) redirects to `/t`.
- `openAttendance` no longer seeds a cache (the queryClient lives in router.tsx, not ours): the page does one extra GET after POST. `useSaveAttendance` seeds the query with the PUT result.
- Not tried in a browser; verified by typecheck + server/web tests only.
- S11 orchestrator: re-ran server 169/169, web 11/11, typecheck clean; openedSessions stash fully removed.
