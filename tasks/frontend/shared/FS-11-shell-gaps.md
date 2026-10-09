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
- Bell: AppShell opens a Sheet with the student `Notifications` list for teacher/admin (student bell untouched, `onBell` prop still overrides). `Notifications` got additive props `sheet` (hide own h3) and `onNavigate` (close sheet on link), and now also invalidates the `['notifications','unread']` badge query on mark-read.
- Log out on Me: button at the end of MePage, same fetch+qc.clear+navigate('/login') as AppShell (duplicated, 4 lines).
- 403: router guard now `redirect('/403')` for a logged-in wrong-area user; `/403` route -> `routes/Forbidden.tsx` ("Go to your home" via `homeOf`). Logged-out still -> /login. Admin badge holders pass the `t` guard (role staff); non-admin teacher at /a gets 403.
- Verified in headless Chrome at 390px (shots/fs11-*.png): teacher bell lists the existing "Two classes overlap at 13:00..." clash notification; /s/commons and /a as teacher -> /403; student Me log out -> /login; logged-out /t -> /login. typecheck, 14 web tests, build green. AppShell.test.tsx unchanged.
