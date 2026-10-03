# QA-05 · Production image smoke test
**Reads:** ARCH §13, D14 · OPS-03, OPS-04
**Owns:** `docs/DEPLOY.md` (results appendix)

## Do
- `npm run build`, then `npm start` against local Postgres (`npm run db:start`) with `NODE_ENV=production`, `COOKIE_SECURE=false` (local http); run `prisma migrate deploy` + `SEED_MODE=prod`; log in as the chief; invite a teacher; create a class; upload a file (local driver, then once against a real S3/R2 bucket); confirm `GET /api/v1/openapi.json`.
- Install the PWA on a phone over a LAN/HTTPS tunnel and check the shell loads offline.

## Done when
- [ ] Every step works with only env changes from dev.

## Notes
