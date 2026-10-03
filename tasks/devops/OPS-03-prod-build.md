# OPS-03 · Production build (API + PWA in one Node process)
**Reads:** ARCH §2 D14, §13
**Owns:** `server/package.json` `start` script, root `start` + `build` script wiring

## Goal
One build that runs on any Node 24 host, configured only by env. No Dockerfile (D14).

## Do
- Root `build` builds web (`web/dist`) then server (`server/dist`, `prisma generate` via prebuild). Root `start` → `npm start -w server`.
- Server `start`: `prisma migrate deploy && node dist/index.js` (prisma is a devDep today: move it to dependencies, or run migrate as a separate deploy step, and note which).
- `app.ts` serves `web/dist` statically, with an SPA fallback for non-`/api` GETs (coordinate with FND-01, which owns app.ts).

## Done when
- [ ] `npm ci && npm run build` succeeds from a clean clone.
- [ ] `NODE_ENV=production npm start` (with `npm run db:start` running) serves the login page at :3000 and `/api/v1/health` returns 200.

## Notes
- S04: was "Dockerfile". A Dockerfile is added only if a chosen host can't run Node directly.
