# FND-09 · Login limiter that survives a lab behind one NAT
**Reads:** docs/DEMO.md F7 · ARCH §5 (auth)
**Owns:** the auth rate-limit config in `server/src/modules/auth/` (and its test)

## Do
- Key the login limiter on IP + normalised email (≈10 tries / 15 min per pair), plus a loose per-IP ceiling (≈300 / 15 min) so a full class can log in together. Keep forgot/reset limits per email.
- Decision (S12, orchestrator): per-pair + loose per-IP is the standard trade-off; record it in ARCH as D17.

## Done when
- [ ] Test: 40 different students log in from one IP within a minute → all succeed; 11 bad tries on one account → 429. Server tests green.

## Notes
