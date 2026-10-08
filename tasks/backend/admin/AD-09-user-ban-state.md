# AD-09 · Ban state on AdminUser
**Reads:** API AD-01 (`GET /admin/users`), AD-06 (bans) · AF-02 Notes
**Owns:** `server/src/modules/admin/users.ts` (list/detail shape), its test; `web/src/routes/admin/people/UserSheet.tsx` (toggle)

## Do
- Add `bannedAt: string | null` (Commons ban) to the `AdminUser` shape in the list/detail responses + openapi; `npm run gen:api`.
- UserSheet: show "Banned from Commons" state and offer Ban **or** Unban, not both.

## Done when
- [ ] Banning s5 → `GET /admin/users?q=` shows `bannedAt` set; sheet offers only Unban. Server tests pass.

## Notes
