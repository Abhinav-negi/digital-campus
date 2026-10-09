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
