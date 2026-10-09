# Deploy checklist (D16)

The app is built and verified on localhost first. Going live is mostly **env changes**, because the code switches local ↔ prod by env vars (D14). This page lists everything that is only needed for a real deployment. The full step-by-step guide is OPS-04, later.

## Env changes (no code)
| What | Local (now) | Production |
|---|---|---|
| Database | `npm run db:start` (embedded Postgres) | `DATABASE_URL` → Neon / Supabase / RDS; run `prisma migrate deploy` on each deploy |
| Email | Gmail SMTP with an App Password (or empty = server log) | `SMTP_*` → Resend / SES / any SMTP with a domain you own |
| Files | local disk `.data/uploads` (`S3_ENDPOINT` empty) | `S3_*` → S3 or Cloudflare R2, with CORS allowing `APP_URL` |
| URLs and cookies | `APP_URL=http://localhost:5173`, `COOKIE_SECURE=false` | `APP_URL=https://your.domain`, `COOKIE_SECURE=true`, `NODE_ENV=production` |
| First admin | `npm run db:reset` (demo cast) | `SEED_MODE=prod SEED_CHIEF_EMAIL=…` on an empty DB, then change the password on first login |

## Code still to write (parked tasks in INDEX "Deployment (later)")
- [ ] **OPS-03** prod build: one Node process serves `/api/v1` + `web/dist`. The S05 attempt failed at `npm start`, so debug it there.
- [ ] **S3 driver** in `server/src/lib/storage.ts`: install `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (it's a stub today). Use `createPresignedPost` with a `content-length-range` and `Content-Type` condition, not a presigned PUT, so S3 enforces size/type like the local driver (R4/FND-11).
- [ ] **OPS-04** `docs/DEPLOY.md`: one host (Render / Railway / Fly) + a VPS variant (Node 24 + systemd + Caddy).
- [ ] **OPS-05** CI on GitHub Actions (typecheck, tests, build).
- [ ] **QA-05** smoke test of the prod build with env changes only.

## Checks before going live
- [ ] `npm audit`: triage the high-severity `deepmerge-ts` warning (transitive).
- [ ] Set a dedicated signing secret for file links (today it falls back to `S3_SECRET_KEY` or a random per-process key, so local file links break after a restart).
- [ ] PWA: install it on a phone over HTTPS and check the shell loads offline.
- [ ] Backups: daily DB backups from the provider.
- [ ] One institution per deployment (D15). Multi-institution needs `institutionId` scoping on every admin and staff query first.
- [ ] Scaling: node-cron runs in one process; move to pg-boss if you run more than one instance.
