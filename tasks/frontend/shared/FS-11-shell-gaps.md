# FS-11 · Shell gaps from the demo: bell panel, phone log out, 403 page
**Reads:** docs/DEMO.md F3a, F4, F6 · SPEC §15 step 7 · API CS-12 (notifications)
**Owns:** `web/src/ui/AppShell.tsx`, `web/src/routes/teacher/index.tsx`, `web/src/routes/admin/AdminLayout.tsx`, `web/src/router.tsx`, a new `web/src/routes/Forbidden.tsx`, the log-out line in `web/src/routes/student/me/MePage.tsx`

## Do
- Bell (teacher + admin): opens a notifications sheet (reuse the student `me/Notifications` list), marks read, count updates; clash notifications link to the day.
- Student Me: a "Log out" button (reuse the AppShell handler) — visible at 390px.
- Opening another role's area (`/s/*` as a teacher, `/a/*` as a non-admin) → a 403 page with a "Go to your home" link instead of a silent redirect. Logged-out users still go to /login.

## Done when
- [ ] At 390px a student logs out from Me; a teacher's bell lists the clash notification; teacher at `/s/commons` sees the 403 page. Web tests/typecheck/build green.

## Notes
