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
- [ ] `openapi.json` validates (e.g. with `npx @redocly/cli lint`).
- [ ] `gen:api` produces types that include the auth routes.

## Notes
