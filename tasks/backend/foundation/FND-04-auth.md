# FND-04 · Auth: sessions, passwords, guards
**Reads:** ARCH §3 (enforcement), §5 (auth row), §14
**Owns:** `server/src/lib/auth.ts`, `server/src/modules/auth/routes.ts` (login/logout/me/forgot/reset)

## Goal
One middleware that understands cookies (web) and Bearer tokens (Flutter), plus the guards that implement **the wall**.

## Do
- `hashPassword` / `verifyPassword` with `node:crypto` scrypt (salted, timing-safe compare).
- Sessions: a random 32-byte token; store the SHA-256 in `LoginSession`; sliding expiry `SESSION_DAYS`. Web → `Set-Cookie dc_session` httpOnly, SameSite=Lax, Secure from config. `client:"app"` → return `{token}` in the body instead.
- `authenticate` middleware: cookie or `Authorization: Bearer` → `req.user` (with `isAdmin`, `isChief`, `role`). Reject disabled or banned users (401 / 403 `BANNED` for the Commons).
- CSRF: for cookie-authenticated non-GET requests, require the `Origin` to match `APP_URL`.
- Guards: `auth()`, `staff()`, `admin()`, `chief()`, **`commons()`**, `classAccess(classIdParam, need)` exactly as ARCH §3; admin passes everything.
- Routes: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` (user + classes summary + flags), `POST /auth/forgot` (always 200), `POST /auth/reset`. Rate limit login/forgot (10/min/IP).

## Done when
- [ ] Logging in as a seed student, teacher and admin works via both cookie and Bearer.
- [ ] A teacher token on any `/commons/*` stub → 403; an admin → passes (reaches 501).
- [ ] A wrong password → 401 with no user enumeration.
- [ ] Auth routes are declared with `route(registry, …)` (lib/openapi.ts); `npm run gen:api` → `web/src/api/schema.d.ts` contains them (carried over from FND-07).

## Notes
