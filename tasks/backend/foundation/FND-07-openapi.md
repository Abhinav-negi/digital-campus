# FND-07 · OpenAPI contract + type generation
**Reads:** ARCH §8, §14
**Owns:** `server/src/lib/openapi.ts`, root script `gen:api`, `web/src/api/schema.d.ts` (generated)

## Goal
The zod schemas become the API contract that the web app (and later Flutter) is typed from.

## Do
- `lib/openapi.ts`: an `OpenAPIRegistry`; a helper `route(registry, {method, path, guard, request, responses})` that registers the docs **and** returns the validator, so docs can't drift from the code.
- `GET /api/v1/openapi.json` (generated at boot).
- `npm run gen:api`: fetch or emit the spec → `openapi-typescript` → `web/src/api/schema.d.ts`.
- Document `cookieAuth` + `bearerAuth` security schemes.

## Done when
- [x] `openapi.json` validates (redocly lint, S03).
- [x] `gen:api` produces types (auth-route check moved to FND-04)

## Notes
- S03: `route(reg, {method, path, summary, guard, request, responses})` records the docs and returns `validate(request)`. It adds 401 (guarded) and 422 (validated) `Error` responses on its own. `summary` is required by Redocly. zod-to-openapi 9.1 with the zod v4 `.meta({ id })` API.
- `GET /api/v1/openapi.json` is built once in app.ts after the module imports. `gen:api` imports openapi.ts and then app.ts in an `-e` one-liner and pipes the spec to openapi-typescript (no DB needed). Don't put an `import.meta.main` block back in openapi.ts: app.ts imports it, and that circular top-level await never settles.
- ✅ The served spec passes `redocly lint` (warnings only: unused security schemes, no operationId/license). The "auth routes in the types" check moved to FND-04's Done when.
- Follow-up: add `operationId` to `route()` before Flutter dart-dio generation.
