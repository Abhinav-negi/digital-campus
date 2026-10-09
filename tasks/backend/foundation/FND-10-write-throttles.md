# FND-10 · Per-user write throttles + retention purge (review R3, R8)
**Reads:** docs/REVIEW.md R3, R8 · ARCH D18
**Owns:** `server/src/lib/auth.ts` (rateLimit keyed by user), its use on messages/answers/tickets/remind/invite-resend/presign/forgot; the jobs module purge; tests

## Do
- `rateLimit` keyed by `req.user.id` on content-creating routes (generous: e.g. 30/min, remind 5/hour per post).
- Daily job: purge read notifications > 90 days, expired sessions and used/expired reset+invite tokens.
- Forgot: 3 mails/15 min per email (R8).

## Done when
- [ ] Tests: the 31st message in a minute → 429; purge removes only old rows. Server tests green.

## Notes
