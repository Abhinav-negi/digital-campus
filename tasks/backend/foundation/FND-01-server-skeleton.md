# FND-01 · Server skeleton + router registry
**Reads:** ARCH §5, §6, §8 (conventions)
**Owns:** `server/package.json`, `server/tsconfig.json`, `server/src/{index,app,config}.ts`, `server/src/lib/http.ts`, `server/src/modules/*/routes.ts` (**stubs only**)

## Goal
A running Express 5 server with the conventions every module uses, and **every module router pre-mounted as a stub**, so parallel agents never edit `app.ts`.

## Do
- `config.ts`: parse `process.env` with zod (keys from OPS-02); fail fast with a readable error.
- `lib/http.ts`: `validate({body,query,params})` middleware (zod → 422 `VALIDATION`), an `HttpError(status, code, message)` class, the error handler → `{error:{code,message}}`, `paginate(cursor, limit)` helpers, `asyncHandler` if needed (Express 5 handles async).
- `app.ts`: JSON body limit 1 MB, cookie-parser, `X-Device-Id` read into `req.deviceId`, `/api/v1` router registry mounting **every module in ARCH §8** from `src/modules/<name>/routes.ts` (each a stub `Router()` that returns 501), `GET /api/v1/health`, and static `web/dist` + SPA fallback in production.
- `index.ts`: boot (config → listen → `jobs.start()` stub).
- Scripts: `dev` (`tsx watch src/index.ts`), `build` (tsc), `start`, `test` (`node --test --import tsx test/`).

## Done when
- [ ] `npm run dev -w server` → `curl :3000/api/v1/health` returns `{ok:true}`.
- [ ] An unknown route → 404 JSON; a zod failure → 422 JSON.
- [ ] Every module path in ARCH §8 responds 501 (proving it's mounted).

## Notes
- S02, verified by the orchestrator: `npm test -w server` 6/6 pass, typecheck clean. Dev curl: health → `{ok:true}`, unknown → 404 JSON, module paths → 501.
- Tests use the glob `'test/**/*.test.ts'` (node refuses a dir) and load `../.env.example`, then `../.env` if present. `dev`/`start` read `../.env`.
- Multi-base modules mount with arrays (`posts`: `/posts` + `/classes/:id/posts`; `attendance`: `/attendance-sessions`, `/checkin`, `/me/attendance`), ordered before `/classes` and `/me`. The routes.ts aggregator rule is in ORCHESTRATOR §6.
- `src/jobs.ts` is an empty `start()` stub; CS-12 replaces it. `tsconfig` covers `src` only, so tests run under tsx without type-checking.
