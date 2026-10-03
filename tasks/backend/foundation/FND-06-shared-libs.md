# FND-06 · Shared libs: audit, notify, storage, dates
**Reads:** ARCH §3 (audit), §5 (files), §7 (AuditLog, Notification), §11
**Owns:** `server/src/lib/{audit,notify,storage,dates}.ts`, `server/src/modules/files/routes.ts`

## Goal
Small helpers that every module calls, so behaviour stays consistent.

## Do
- `audit(actor, {action, classId?, targetType, targetId, before?, after?}, tx?)`: one row; it accepts a Prisma transaction.
- `notify(userIds, type, payload, tx?)`: bulk insert; respects the user's muted types except `class-change`.
- `storage.ts`: `presignPut(key, contentType)`, `presignGet(key)`, `deleteObject(key)` with the S3 client from config. `S3_ENDPOINT` empty → local driver (D14): files in `.data/uploads/<key>`; presign returns `APP_URL/api/v1/files/local/<key>?exp=…&sig=…` (HMAC-SHA256 of method+key+exp, `node:crypto`, 15-min expiry), and `files/routes.ts` serves PUT/GET on that path after checking sig + expiry. Same API shape as S3, so callers never branch. `ponytail:` single-disk dev store; real S3/R2 in prod.
- `POST /files/presign {name, contentType, size}` → `{uploadUrl, key}`; allow pdf/png/jpg/webp/zip up to 15 MB; key `uploads/<userId>/<cuid>-<safeName>`.
- `dates.ts`: `today(tz)`, `dow(date)`, `addDays`, all in the institution timezone (never the server clock's zone).

## Done when
- [ ] With `S3_ENDPOINT` empty: a presigned PUT from curl lands in `.data/uploads`, `presignGet` downloads it, and a tampered or expired sig → 403 (unit test).
- [ ] Unit test: `today()` differs from UTC around 20:00 UTC (IST rollover).

## Notes
- Done S05. Keys use `randomUUID()` (no cuid dep); extension comes from `contentType`, not the name (stops `x.html` served as HTML). Files land at `.data/uploads/uploads/<userId>/…` (key already starts with `uploads/`).
- HMAC secret = `S3_SECRET_KEY`, else a dev constant; in prod without a key it's per-process random (links die on restart). `/files/local/*` is not in OpenAPI; clients follow the URL.
- `audit(actor: {id}, …)` takes `req.user` directly. S3 branch throws until `@aws-sdk/client-s3` + `s3-request-presigner` are installed (OPS-03).
- **Gap:** `notify` doesn't filter muted types; the schema has no mute column. Add `User.mutedTypes String[]` as a migration before CS-12 (it needs it for notification prefs).
