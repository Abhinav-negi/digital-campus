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

## Docs
- [ORCHESTRATOR.md](ORCHESTRATOR.md): how the build is run
- [ARCHITECTURE.md](ARCHITECTURE.md): decisions, stack, data model, API
- [DESIGN.md](DESIGN.md): the visual system
- [INDEX.md](INDEX.md): the task board
