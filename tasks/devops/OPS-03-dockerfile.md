# OPS-03 · Production image (API + PWA in one container)
**Reads:** ARCH §4, §13
**Owns:** `server/Dockerfile`, `.dockerignore`, root `build` script wiring

## Goal
A single image that runs anywhere Docker runs, configured only by env.

## Do
- Multi-stage: deps → build web (`web/dist`) and server (`server/dist` + `prisma generate`) → slim `node:24-slim` runtime, non-root user.
- CMD: `npx prisma migrate deploy && node dist/index.js`.
- `app.ts` serves `web/dist` statically, with an SPA fallback for non-`/api` GETs (coordinate with FND-01, which owns app.ts).
- `HEALTHCHECK` on `GET /api/v1/health`.

## Done when
- [ ] `docker build -f server/Dockerfile -t digital-campus .` succeeds.
- [ ] `docker run --env-file .env --network host digital-campus` serves the login page at :3000 and `/api/v1/health` returns 200.

## Notes
