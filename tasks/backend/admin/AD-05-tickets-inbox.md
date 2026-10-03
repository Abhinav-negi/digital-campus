# AD-05 · Tickets + admin inbox
**Reads:** ARCH §2 D6, §7 (Ticket)
**Owns:** `server/src/modules/tickets/routes.ts`, `server/src/modules/admin/inbox.ts`, `server/test/tickets.test.ts`

## Endpoints
- Users (student or staff): `POST /tickets {category, subject, body}` · `GET /tickets/mine` · `GET /tickets/:id` (own) · `POST /tickets/:id/replies {body}` (own, reopens if answered).
- Admin: `GET /admin/inbox?type=tickets|reports|all&state=` → one merged list, newest first, with counts per state; `POST /tickets/:id/replies` (admin → state `answered`, notify the user); `PATCH /admin/tickets/:id {state: closed}`.
- Reports appear in the inbox from CM-07; their actions are in AD-06.

## Done when
- [ ] Tests: a student can't read another's ticket; an admin reply notifies + changes state; the inbox merges both types.

## Notes
