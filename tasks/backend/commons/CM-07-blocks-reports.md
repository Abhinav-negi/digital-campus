# CM-07 · Block + Report (with auto-hide)
**Reads:** SPEC §12 (Safety, Moderation) · PROTO `student.html:340-344` (report reasons), `:593`
**Owns:** `server/src/modules/commons/safety.ts`, `server/test/safety.test.ts` · may extend (block filter only) `commons/{board,profiles,conversations}.ts`
> All routes sit under `/commons` behind the `commons()` guard (FND-04): students + admins; teachers get 403.

## Endpoints
- `POST /commons/blocks {userId}` · `DELETE /commons/blocks/:userId` · `GET /commons/blocks`. Blocking hides each person's content from the other in people, board and conversations.
- `POST /commons/reports {targetType, targetId, reason}`: reasons `Spam | Unsafe or prohibited | Academic dishonesty (gigs only) | Harassment | Other`; one per reporter per target.
- **Auto-hide:** when distinct open reports on a target reach **3**, set the target's `hiddenAt` until the admin reviews it (AD-06), and audit as the system.

## Done when
- [ ] Tests: the third distinct report hides the post from the feed; a duplicate report → 409; block filtering works in people and the board.

## Notes
- `blockedIds(userId)` / `blockedEitherWay` live in safety.ts (either direction); conversations.ts now imports them. Applied to People, GET /profiles/:id (404), the board feed, and the conversation list.
- Auto-hide covers board/project/challenge (the only models with `hiddenAt`); message/profile reports are stored only. Reports stay `open` for AD-06 to resolve; AD-06 should clear `hiddenAt` on dismiss.
- No system actor: AuditLog.actorId is a required User FK, so the 3rd reporter is the actor and `after.system: true` marks it automatic (action `report.auto-hide`). Real fix = schema/audit.ts change.
- Reason "Academic dishonesty" is 422 unless the target is a gig; reporting own content 422; hidden/missing/other-institution target 404; message reports need participation. Dup = 409 (any prior state).
- Board feed already filtered `hiddenAt: null`; no change needed. Project/challenge lists not block-filtered (outside the task's scope).
