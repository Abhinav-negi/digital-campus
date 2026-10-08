# CS-16 · Notification links point at real web routes
**Reads:** `server/src/modules/me/notifications.ts` (`linkFor`) · `web/src/routes/{student,teacher}/routes.ts`
**Owns:** `server/src/modules/me/notifications.ts` + its test

## Do
Map payloads to routes that exist (from ST-10b, S10):
- `conversationId` → `/s/me/messages/:id` · `ticketId` → `/s/me` (students) · `projectId`/`challengeId` → `/s/commons/build`
- `post` → `/s/class/posts` (student) · other board posts → `/s/commons`
- `class-change` → `/s` or `/t` · `attendance-low`/`-digest` → `/s/class/attendance` or `/t`
- `exam-`/`deadline-reminder` → `/s` (student) or `/t/upcoming` · fallback `classId` → `/s/class` or `/t/classes/:id`
- Anything unmapped → `null` (the client already handles null).

## Done when
- [x] Test: one notification per mapped type for a student and a teacher returns the path above; no link starts with `/s/today`, `/t/today` or `/s/commons/messages`.

## Notes
- Re-check against the route tables when ST-08a (Build) and AF-01 (admin) add routes.
- Done: `linkFor` is exported; student-only payloads (conversation, ticket, project, challenge, board post) return null for staff. Test: `linkFor maps every payload type…` in notifications.test.ts.
- S11 orchestrator: server 171/171 (both test DBs). Staff get null for ticket links: only the filer is notified and teachers have no tickets UI.
