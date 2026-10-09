# FND-10 · Per-user write throttles + retention purge (review R3, R8)
**Reads:** docs/REVIEW.md R3, R8 · ARCH D18
**Owns:** `server/src/lib/auth.ts` (rateLimit keyed by user), its use on messages/answers/tickets/remind/invite-resend/presign/forgot; the jobs module purge; tests

## Do
- `rateLimit` keyed by `req.user.id` on content-creating routes (generous: e.g. 30/min, remind 5/hour per post).
- Daily job: purge read notifications > 90 days, expired sessions and used/expired reset+invite tokens.
- Forgot: 3 mails/15 min per email (R8).

## Done when
- [x] Tests: the 31st message in a minute → 429; purge removes only old rows. Server tests green.

## Notes
- `perUser(max, windowMs, extra?)` in lib/auth.ts wraps `rateLimit` keyed `userId|extra`; applied to messages, answers, tickets (create + replies), presign (30/min), invite resend (20/h), remind (5/h, key adds post id). Forgot gained 3/15 min per email.
- `purgeStale` (jobs.ts, 03:10): read notifications created >90d ago, expired sessions, reset tokens used AND expired, invites accepted AND expired. Pending/unused tokens are never touched.
- Tests: 31st ticket / 31st message / 4th forgot → 429; purge test checks each survivor. Gotcha: limiters are per-process, so a test file's earlier calls count toward the same user's budget (message test uses s9).
- wall.test.ts untouched and green; `npm test --workspace server` 184/184, typecheck clean.
