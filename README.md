# Digital Campus

A class space + student commons for one institution: an Express 5 API (`server/`) and a React PWA (`web/`).

## Quick start
```
cp .env.example .env
npm install
npm run db:start              # postgres:5432, no Docker; keep this terminal open
npm run db:reset              # truncate + seed (demo cast); fresh DB: run migrate deploy first
npm run dev                   # server :3000 + web :5173 (proxy /api → :3000); emails print in its log
npm test
```
Seed logins (password `campus123`): chief admin `academics@demo.edu`, teacher `meera.iyer@demo.edu`, CR student Riya Patel.

Other scripts: `npm run typecheck`, `npm run build`, `npm run gen:api`.

## Real emails (free, Gmail)
By default, invite and reset emails are printed in the server log. To send real ones, use a Gmail account:
1. Turn on 2-Step Verification, then create an App Password at https://myaccount.google.com/apppasswords.
2. In `.env`: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=you@gmail.com`, `SMTP_PASS=<the 16-letter app password>`, `SMTP_FROM="Digital Campus <you@gmail.com>"`.
3. Restart `npm run dev`. Gmail allows about 500 emails a day, which is plenty for a demo.

## Demo on phones (same Wi-Fi)
Invite links are built from `APP_URL`, so `localhost` links won't open on a phone.
1. Find the laptop's Wi-Fi address with `hostname -I` (e.g. `192.168.1.20`).
2. In `.env`: `APP_URL=http://192.168.1.20:5173`, then start the web app with `npm run dev -w web -- --host` (and the server with `npm run dev -w server`).
3. Open `http://192.168.1.20:5173` on the laptop **and** the phones. Writes check that the browser's origin matches `APP_URL`, so `localhost` won't work in this setup.

## Deploying
Not needed for the college project. Everything is listed in [docs/DEPLOY-CHECKLIST.md](docs/DEPLOY-CHECKLIST.md).

## Docs
- [ORCHESTRATOR.md](ORCHESTRATOR.md): how the build is run
- [ARCHITECTURE.md](ARCHITECTURE.md): decisions, stack, data model, API
- [DESIGN.md](DESIGN.md): the visual system
- [INDEX.md](INDEX.md): the task board
- [docs/DEPLOY-CHECKLIST.md](docs/DEPLOY-CHECKLIST.md): what's left for a real deployment
