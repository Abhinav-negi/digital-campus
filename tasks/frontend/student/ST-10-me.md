# ST-10 · Me: profile, messages, notifications, data, contact admin
**Reads:** SPEC §9.1, §12 · ARCH §2 D6 · PROTO `student.html:475-517`, `:620-626` · API CM-01, CM-06, CS-12, AD-05
**Owns:** `web/src/routes/student/me/*`

## Do
- The header (avatar xl, name, label, ID, track record); availability tabs + helps-juniors switch + focus date; the profile form; My projects; My board posts.
- Messages: incoming requests (Accept/Ignore), conversations → the thread sheet (polls 5s), waiting list.
- Notifications list + Mark all read (also from the bell).
- **Contact admin**: a "Need help?" card → a ticket form (category, subject, message) + My tickets with admin replies.
- Your data: Export (`GET /me/export`, CM-01) · Delete account (a confirm sheet with password → `DELETE /me`, AD-01).

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] Parity with the PROTO Me; a ticket round-trips with the admin.

## Notes
