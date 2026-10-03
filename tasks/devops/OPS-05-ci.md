# OPS-05 · CI pipeline
**Reads:** ARCH §15
**Owns:** `.github/workflows/ci.yml`

## Goal
Every push runs typecheck, tests and the build, so nobody merges a broken wall.

## Do
- GitHub Actions: Node 24, a postgres:17 service, `npm ci`, `prisma migrate deploy` against the test DB, `npm run typecheck`, `npm test`, `npm run build`.
- Cache npm.

## Done when
- [ ] The workflow passes on a clean push.

## Notes
