# ST-10b · Me: messages, notifications, contact admin
**Reads:** SPEC §9.1 · ARCH §2 D6 · PROTO `student.html:476-479`, `:480-517` (rMe message parts, threadSheet, notifSheet), `:620-626` · API CM-06, CS-12, AD-05
**Owns:** `web/src/routes/student/me/{Messages,ThreadSheet,Notifications,Tickets}.tsx`

## Do
- Messages: incoming requests (Accept/Ignore), conversations → the thread sheet (polls 5s), waiting list.
- Notifications list + Mark all read (also from the bell).
- **Contact admin**: a "Need help?" card → ticket form (category, subject, message) + My tickets with admin replies.
- Mount each as a section of ST-10a's MePage (one import + one line each).

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] A message request round-trips; a ticket round-trips with the admin.

## Notes
- From CS-12 (S07): notification `link`s are guessed web paths in `linkFor` (server/src/modules/me/notifications.ts); align them with the real routes here. CM-06 notifies per message (type `message`, mutable).
- Done: Messages/ThreadSheet/Notifications/Tickets mounted in MePage (Messages, Notifications, "Need help?"). Deep link `/s/me/messages/:id` opens the thread sheet (MePage `me/*` splat); closing returns to `/s/me`.
- Thread polls via `usePoll` 5s, first 100 messages only (`ponytail:`). My tickets lists `/tickets/mine` (no replies), tapping loads `/tickets/{id}` with admin replies and a reply box.
- Notifications: row tap marks it read then navigates to `n.link`; the bell is not wired. `linkFor` is wrong for the real routes, see the report (needs: conversationId -> `/s/me/messages/:id`, no student ticket page, `/s/commons/...` has no projects/challenges/board/:id routes yet).
- Verified against live API (curl): request, accept, a message each way, ticket open, admin reply, my tickets reply, ticket-reply notification.
- S10 orchestrator: live curl verified (request→accept→messages both ways; ticket→admin reply→student sees it). Notification rows made <button>s (keyboard). linkFor fixes tracked as CS-16.
