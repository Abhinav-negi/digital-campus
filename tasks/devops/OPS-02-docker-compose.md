# OPS-02 · Docker Compose for local services + env
**Reads:** ARCH §4, §5, §12, §13
**Owns:** `docker-compose.yml`, `.env.example`

## Goal
One command starts every backing service locally, with the same env names prod will use.

## Do
- Services: `postgres:17` (volume, healthcheck, db `campus` + db `campus_test`, created by an init script), `axllent/mailpit` (1025/8025), `minio/minio` (9000/9001) + a one-shot `minio/mc` that creates bucket `campus` and makes CORS allow `http://localhost:5173`.
- `.env.example` keys: `DATABASE_URL`, `TEST_DATABASE_URL`, `APP_URL=http://localhost:5173`, `PORT=3000`, `COOKIE_SECURE=false`, `SESSION_DAYS=30`, `SMTP_HOST/PORT/USER/PASS/FROM`, `S3_ENDPOINT/REGION/BUCKET/ACCESS_KEY/SECRET_KEY/FORCE_PATH_STYLE`, `ANTHROPIC_API_KEY=` (empty = import disabled), `IMPORT_MODEL=claude-sonnet-5-5`, `INSTITUTION_TZ=Asia/Kolkata`.

## Done when
- [ ] `docker compose up -d` → all healthy. Mailpit UI at :8025, MinIO console at :9001, and the `campus` bucket exists.
- [ ] `psql $DATABASE_URL -c 'select 1'` works (or Prisma connects).

## Notes
