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
