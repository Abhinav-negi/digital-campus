# OPS-02 · Local services without Docker + env
**Reads:** ARCH §2 D14, §5, §12, §13
**Owns:** `scripts/db.mjs`, `.env.example`

## Goal
One command starts every backing service locally, with the same env names prod will use. No Docker, no sudo.

## Do
- `npm run db:start`: Postgres 17 via `embedded-postgres` (root devDep), user/pass `campus`, port 5432, data in `.data/pg`; creates dbs `campus` + `campus_test` on first run. Foreground; Ctrl-C stops it.
- Mail and files need no service: empty `SMTP_HOST` → server log (FND-05), empty `S3_ENDPOINT` → local disk (FND-06).
- `.env.example` keys: `DATABASE_URL`, `TEST_DATABASE_URL`, `APP_URL=http://localhost:5173`, `PORT=3000`, `COOKIE_SECURE=false`, `SESSION_DAYS=30`, `SMTP_HOST/PORT/USER/PASS/FROM`, `S3_ENDPOINT/REGION/BUCKET/ACCESS_KEY/SECRET_KEY/FORCE_PATH_STYLE`, `ANTHROPIC_API_KEY=` (empty = import disabled), `IMPORT_MODEL=claude-sonnet-5-5`, `INSTITUTION_TZ=Asia/Kolkata`.

## Done when
- [x] `npm run db:start` → `postgres:5432 ready`; Prisma connects to both dbs.

## Notes
- S04: replaced Docker Compose (the user wasn't in the `docker` group, and MinIO's community builds are no longer maintained). Verified: `migrate deploy` applied to `campus` and `campus_test`, 41 tables, PostgreSQL 17.10.
- npm 11 blocks install scripts: root `package.json` `allowScripts` approves `@embedded-postgres/linux-x64`. On another OS/arch, run `npm install-scripts approve @embedded-postgres/<platform>` once.
- Prisma refuses `migrate reset` from an AI agent without the user's typed consent. Agents use `npm run prisma -- migrate deploy` on a fresh db; humans run `npm run db:reset` as before.
- Wipe local data: stop it, then `rm -rf .data/pg`.
