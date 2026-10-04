# CS-12 · Notifications inbox + scheduled jobs
**Reads:** ARCH §11 · SPEC §11
**Owns:** `server/src/modules/me/notifications.ts`, `server/src/jobs.ts`, `server/test/notifications.test.ts`

## Endpoints
- `GET /me/notifications?cursor=` → items `{id,type,text,link,payload,read,createdAt}`. `text` and `link` are rendered server-side per type (clients stay thin), plus `unreadCount`.
- `POST /me/notifications/read {ids? | all:true}`.
- `GET/PUT /me/notification-prefs {muted:[types]}`. `class-change` can't be muted (422).

## Jobs (`jobs.ts`, node-cron, institution tz; each also exported as a plain function for tests)
- 07:00: exams and deadlines exactly 3 days and 1 day away → students of the class + the subject teacher.
- 07:05: board posts expiring in 2 days → the poster ("Still need this? Extend · Close").
- 03:00: delete expired unaccepted invites older than 30 days.
- 07:10: attendance below the minimum digest (only on change; skip if already notified this week).

## Done when
- [ ] Tests call the job functions with a fixed date and assert the notifications; the mute rule is enforced.

## Notes
- `text` lives in each notification's payload (set by whoever calls `notify`); the inbox renders `link` per type/payload keys and the `/s` vs `/t` shell. Link paths are a guess until the web routes exist.
- Job idempotency is derived from existing rows (payload `boardItemId`+`days`, `postId`+`expiresAt`), so no schema change. Extending a post changes `expiresAt`, so it nudges again.
- New types: `exam-reminder`, `deadline-reminder`, `board-expiring`, `attendance-digest` (all mutable). Muted users get no row, so a re-run does not retry them.
- Attendance digest: skipped if a digest exists in the last 7 days or the low-subject set equals the last digest's. Reuses `standing` (now exported from attendance/routes.ts).
- Invite cleanup: unaccepted, `expiresAt < now` and `createdAt` older than 30 days. `start()` is a no-op when NODE_ENV=test.
- Run `npm run gen:api` to refresh the OpenAPI client for the new /me routes (not run).

