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
