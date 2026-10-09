# OPS-06 · trust proxy behind Caddy (review R1)
**Reads:** docs/REVIEW.md R1 · ARCH D18 · docs/DEPLOY-CHECKLIST.md
**Owns:** `server/src/app.ts` (orchestrator-owned: one line), `docs/DEPLOY-CHECKLIST.md`

## Do
- `app.set('trust proxy', env.TRUST_PROXY)` (hop count, default 0 locally, 1 behind Caddy) so `req.ip` is the client and D18's per-IP keys work.

## Done when
- [ ] Test with `X-Forwarded-For` and TRUST_PROXY=1: two different client IPs get separate limiter buckets.

## Notes
