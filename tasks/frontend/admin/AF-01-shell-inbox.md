# AF-01 · Admin shell + Inbox
**Reads:** ARCH §2 D2, D6, §10 · PROTO `admin.html:20-63`, `:86-99` · API AD-05, AD-06 (report actions), AD-08 (overview)
**Owns:** `web/src/routes/admin/{AdminLayout,Inbox,TicketSheet}.tsx`, `web/src/routes/admin/queries.ts` (create)

## Do
- AppShell (teacher palette, brand "Admin"); nav: Inbox · People · Classes · Commons · School · Audit. Drop the old "Admins can't see…" banner (D2 reverses it).
- Inbox: overview stats on top (AD-08); a filter Tickets / Reports / All + state chips; a ticket row → a sheet thread with reply + close; a report row → the target preview + Hide / Warn / Delete / Dismiss.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] A student ticket appears; the reply reaches the student's Me.

## Notes
- Done AF-01. AdminLayout (AppShell admin, 6 nav items, no old banner), `routes.ts` table (index → Inbox; AF-02..05 lines → Soon), `/a` in router.tsx mirrors /s and /t.
- Inbox: overview stat row (open tickets/reports, pending invites, classes without timetable), type tabs + state tabs (server `?type=&state=`), ticket row → TicketSheet (reply, Close/Reopen), report row → Hide/Warn/Delete(confirm)/Dismiss.
- The report "preview" shows only targetType, targetId and reason: no read-one-target endpoint exists for admins yet (AF-04a/AD-06 `PATCH /admin/commons/...` has no GET).
- Admin reads the thread via shared `GET /tickets/{id}` (works for admins); reply via `POST /tickets/{id}/replies`.
- Left the now-unused `page()` helper in router.tsx (outside the allowed line); delete it in a later pass.
- S11 orchestrator: live curl verified (ticket in inbox → admin reply → student sees it; close; dismiss report). Removed the unused /a placeholder page() from router.tsx. Report target preview is type/id/reason only (no read-one-target endpoint) → revisit in AF-04a.
