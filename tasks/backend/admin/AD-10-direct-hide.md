# AD-10 · Admin direct hide + hidden items in admin lists
**Reads:** API AD-06, CM-02/04/05 list routes · AF-04a Notes
**Owns:** `server/src/modules/admin/moderation*.ts`, the CM list handlers' `where` (admin branch only), their tests; `web/src/routes/admin/commons/Moderation.tsx`

## Do
- `POST /admin/commons/:type/:id/hide` (no report needed), audited like unhide.
- Board/projects/challenges lists: for admins, `?includeHidden=1` returns hidden items with `hiddenAt`. Students never see them (the wall).
- Moderation.tsx: drop the inbox-based "Hidden" workaround; Hide always enabled; hidden items inline with the badge. `npm run gen:api`.

## Done when
- [ ] Admin hides an unreported post → gone from the student feed, present with `hiddenAt` in the admin list; a student passing `includeHidden=1` still gets nothing hidden. Server tests pass.

## Notes
- Done: `POST /admin/commons/:type/:id/hide` (idempotent, audit `commons.hide` like unhide; profile -> 422). `?includeHidden=1|true` on GET board-posts/projects/challenges: honoured only if `req.user.isAdmin`, else ignored; hidden items carry optional `hiddenAt` (only when shown that way, so student bodies are unchanged).
- Web: ModTarget got `hidden?`; Board/BuildPage/Challenges pass includeHidden when `moderation` is set (query keys include it); ModRow Hide always enabled; HiddenList/useOpenReports and inbox workaround removed; `useCommonsMod.hide` now takes {type,id}. Schema regenerated.
- Test: moderation.test.ts "direct hide" (audit, student feed + student includeHidden, admin with/without flag, projects, challenges). Checks all green: typecheck, server 177/177, web 14/14, build.
