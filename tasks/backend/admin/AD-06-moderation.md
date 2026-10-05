# AD-06 · Commons moderation + conversation access
**Reads:** ARCH §2 D2 · SPEC §12 · PROTO `admin.html:86-99`, `:122-128`
**Owns:** `server/src/modules/admin/moderation.ts`, `server/test/moderation.test.ts`

## Endpoints
- `POST /admin/reports/:id {action: hide|warn|dismiss|delete}`: hide sets the target's `hiddenAt`; warn notifies the author; delete removes the target; all audited.
- `PATCH /admin/commons/:type/:id` (board-post | project | challenge | profile): edit any field; `POST …/unhide`; `DELETE …`. Audited with before/after.
- `POST /admin/users/:id/ban {reason, until?}` / `DELETE …/ban`: a banned student gets 403 `BANNED` on the Commons but keeps the Class space.
- `GET /admin/conversations?userId=&q=` and `GET /admin/conversations/:id/messages`: **full read access (D2); every open writes an audit row** ("Read conversation X").

## Done when
- [ ] Tests: hide removes it from the feed; a ban blocks the Commons but not the class; reading a conversation creates an audit row; a non-admin → 403.

## Notes
- From CM-07 (S07): auto-hidden targets keep their reports `open`; resolving here must set report state and clear `hiddenAt` on dismiss. Auto-hide audits with the 3rd reporter as actor + `after.system: true` (no system user exists).
- From CM-06: `findConversation(id, me, read)` in commons/conversations.ts lets admins read; your audited read route should reuse it.
- S08 ✅ The `commons()` guard already enforced `bannedAt` (no guard change). Resolving a report closes every open report on that target. PATCH whitelists text fields per type.
- Orchestrator closed the unaudited admin read: `GET /commons/conversations/:id/messages` no longer lets admins in; the only admin read is `/admin/conversations/:id/messages`, which audits every page.
- S08 (user OK): `User.bannedUntil` migration. `authenticate()` lifts an expired ban on the next request, and the hourly `liftExpiredBans` job (jobs.ts, :15) catches the rest, so lists that filter `bannedAt: null` catch up within an hour.
