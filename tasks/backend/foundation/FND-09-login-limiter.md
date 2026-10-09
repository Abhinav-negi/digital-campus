# FND-09 · Login limiter that survives a lab behind one NAT
**Reads:** docs/DEMO.md F7 · ARCH §5 (auth)
**Owns:** the auth rate-limit config in `server/src/modules/auth/` (and its test)

## Do
- Key the login limiter on IP + normalised email (≈10 tries / 15 min per pair), plus a loose per-IP ceiling (≈300 / 15 min) so a full class can log in together. Keep forgot/reset limits per email.
- Decision (S12, orchestrator): per-pair + loose per-IP is the standard trade-off; recorded in ARCH as D18.

## Done when
- [ ] Test: 40 different students log in from one IP within a minute → all succeed; 11 bad tries on one account → 429. Server tests green.

## Notes
- Hand-rolled `rateLimit` in lib/auth.ts got an optional `keyOf(req)` (default IP). No test-mode bypass exists, so the new test hits the real limiter.
- /auth/login: two stacked limiters, 300/15min per IP and 10/15min per `ip|normalised email`. /auth/forgot: 10/min keyed on normalised email. No /auth/reset limiter existed; admin/users.ts limiter untouched.
- Gotcha: body email is read from raw req.body (before zod), trimmed+lowercased; the in-memory counters are per process.
- Test: 40 inserted lab users all log in (200); 10th bad try on one pair is 429 (counting the earlier good login); other accounts unaffected. typecheck + 178 server tests green.
