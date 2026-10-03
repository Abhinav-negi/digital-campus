# FND-06 · Shared libs: audit, notify, storage, dates
**Reads:** ARCH §3 (audit), §5 (files), §7 (AuditLog, Notification), §11
**Owns:** `server/src/lib/{audit,notify,storage,dates}.ts`, `server/src/modules/files/routes.ts`

## Goal
Small helpers that every module calls, so behaviour stays consistent.

## Do
- `audit(actor, {action, classId?, targetType, targetId, before?, after?}, tx?)`: one row; it accepts a Prisma transaction.
- `notify(userIds, type, payload, tx?)`: bulk insert; respects the user's muted types except `class-change`.
- `storage.ts`: `presignPut(key, contentType)`, `presignGet(key)`, `deleteObject(key)` with the S3 client from config (MinIO locally, path-style).
- `POST /files/presign {name, contentType, size}` → `{uploadUrl, key}`; allow pdf/png/jpg/webp/zip up to 15 MB; key `uploads/<userId>/<cuid>-<safeName>`.
- `dates.ts`: `today(tz)`, `dow(date)`, `addDays`, all in the institution timezone (never the server clock's zone).

## Done when
- [ ] A presigned PUT from curl uploads to MinIO, and `presignGet` downloads it.
- [ ] Unit test: `today()` differs from UTC around 20:00 UTC (IST rollover).

## Notes
