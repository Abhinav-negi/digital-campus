# CM-11 · Enforce blocks on Commons actions and direct reads (review R2)
**Reads:** docs/REVIEW.md R2 · API CM-07
**Owns:** a shared `isBlocked(a, b)` helper in `server/src/modules/commons/` and its use in answers/interest/claims/join/like/thanks + the by-id GETs; tests

## Do
- Either side blocked → 403 (or 404 on by-id reads) on every Commons action and direct read between the two users; no notification to the blocker.

## Done when
- [ ] Test: s2 blocks s3 → s3 can't answer/claim/join/like s2's items or open them by id; s2 gets no notification. QA-01 wall suite stays green.

## Notes
