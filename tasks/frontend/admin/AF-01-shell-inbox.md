# AF-01 · Admin shell + Inbox
**Reads:** ARCH §2 D2, D6, §10 · PROTO `admin.html:20-63`, `:86-99` · API AD-05, AD-06 (report actions), AD-08 (overview)
**Owns:** `web/src/routes/admin/{AdminLayout,Inbox,TicketSheet}.tsx`, `web/src/routes/admin/queries.ts` (create)

## Do
- AppShell (teacher palette, brand "Admin"); nav: Inbox · People · Classes · Commons · School · Audit. Drop the old "Admins can't see…" banner (D2 reverses it).
- Inbox: overview stats on top (AD-08); a filter Tickets / Reports / All + state chips; a ticket row → a sheet thread with reply + close; a report row → the target preview + Hide / Warn / Delete / Dismiss.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] A student ticket appears; the reply reaches the student's Me.

## Notes
