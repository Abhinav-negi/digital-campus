# OPS-04 · Deploy guide
**Reads:** ARCH §13, §14
**Owns:** `docs/DEPLOY.md`

## Goal
Anyone can take the image live on real infrastructure in under an hour.

## Do
- The env var table (prod values and where to get them): managed Postgres (Neon/Supabase/RDS), S3 or Cloudflare R2 (+ CORS for APP_URL), SMTP (Resend/SES), Anthropic key.
- Step-by-step for one host (Render or Fly) + a generic VPS/Docker variant.
- The first chief admin: run the seed in prod mode (`SEED_MODE=prod` creates only the institution, branches and the chief) and change the password on first login.
- Backups, migrations on deploy, rotating secrets, and scaling notes (the cron in one instance → pg-boss).

## Done when
- [ ] A teammate can follow it without asking questions (dry read).

## Notes
