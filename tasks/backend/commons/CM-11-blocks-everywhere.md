# CM-11 · Enforce blocks on Commons actions and direct reads (review R2)
**Reads:** docs/REVIEW.md R2 · API CM-07
**Owns:** a shared `isBlocked(a, b)` helper in `server/src/modules/commons/` and its use in answers/interest/claims/join/like/thanks + the by-id GETs; tests

## Do
- Either side blocked → 403 (or 404 on by-id reads) on every Commons action and direct read between the two users; no notification to the blocker.

## Done when
- [ ] Test: s2 blocks s3 → s3 can't answer/claim/join/like s2's items or open them by id; s2 gets no notification. QA-01 wall suite stays green.

## Notes
- Reused CM-07's `blockedEitherWay` (no new pair helper); added `unblocked(me, ids)` in safety.ts to drop blocked people from notify lists.
- `findPost`/`findProject`/`findChallenge` now 404 when the owner is blocked either way (skipped for own items), which covers every action and by-id GET through the finders.
- Third-party notifies (assign, confirm claim, thanks, gig-done, join reply, winners, board-match routing) go through `unblocked`.
- Test: safety.test.ts "CM-11" (s2 blocks s3: all six actions + three GETs 404, s2 notifications unchanged, unblock restores). typecheck + 179 server tests green.
- Left: an old answer by a since-blocked person still shows in the blocker's own post detail (card.ts hides it only on the dashboard).
