# CM-07 · Block + Report (with auto-hide)
**Reads:** SPEC §12 (Safety, Moderation) · PROTO `student.html:340-344` (report reasons), `:593`
**Owns:** `server/src/modules/commons/safety.ts`, `server/test/safety.test.ts`
> All routes sit under `/commons` behind the `commons()` guard (FND-04): students + admins; teachers get 403.

## Endpoints
- `POST /commons/blocks {userId}` · `DELETE /commons/blocks/:userId` · `GET /commons/blocks`. Blocking hides each person's content from the other in people, board and conversations.
- `POST /commons/reports {targetType, targetId, reason}`: reasons `Spam | Unsafe or prohibited | Academic dishonesty (gigs only) | Harassment | Other`; one per reporter per target.
- **Auto-hide:** when distinct open reports on a target reach **3**, set the target's `hiddenAt` until the admin reviews it (AD-06), and audit as the system.

## Done when
- [ ] Tests: the third distinct report hides the post from the feed; a duplicate report → 409; block filtering works in people and the board.

## Notes
