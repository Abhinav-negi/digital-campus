# Digital Campus

A class space + student commons for one institution: an Express 5 API (`server/`) and a React PWA (`web/`).

## Quick start
```
cp .env.example .env
docker compose up -d          # postgres:5432 · mailpit smtp:1025 ui:8025 · minio:9000 console:9001
npm install
npm run db:reset              # prisma migrate reset + seed (demo cast)
npm run dev                   # server :3000 + web :5173 (proxy /api → :3000)
npm test
```
Seed logins (password `campus123`): chief admin `academics@demo.edu`, teacher `meera.iyer@demo.edu`, CR student Riya Patel.

Other scripts: `npm run typecheck`, `npm run build`, `npm run gen:api`.

## Docs
- [ORCHESTRATOR.md](ORCHESTRATOR.md): how the build is run
- [ARCHITECTURE.md](ARCHITECTURE.md): decisions, stack, data model, API
- [DESIGN.md](DESIGN.md): the visual system
- [INDEX.md](INDEX.md): the task board
