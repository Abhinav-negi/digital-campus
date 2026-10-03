# OPS-01 · Monorepo + workspaces
**Reads:** ARCH §5, §6, §12
**Owns:** `package.json`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`, `.nvmrc`, `README.md`

## Goal
The root of the repo: npm workspaces `server` and `web`, plus the shared scripts every later task relies on.

## Do
- Root `package.json`: `"workspaces": ["server","web"]`; scripts `dev` (runs both, e.g. `npm run dev -w server & npm run dev -w web`, or the `concurrently` dev dependency), `build`, `test`, `db:reset`, `gen:api`, `typecheck`.
- `tsconfig.base.json`: strict, ES2023, `moduleResolution: bundler` for web, NodeNext for server (each workspace extends it).
- `.nvmrc` = 24. `.gitignore` covers node_modules, dist, .env, coverage.
- README: a quick start copied from ARCH §12, plus links to ORCHESTRATOR / ARCHITECTURE / DESIGN.

## Done when
- [ ] `npm install` at the root succeeds with empty workspaces.
- [ ] `npm run typecheck` runs (even if it's a no-op).

## Notes
- Done by the orchestrator (S02). npm errors "No workspaces found" on empty dirs, so `server/package.json` and `web/package.json` were seeded as name-only stubs (`@campus/server`, `@campus/web`); FND-01 / FS-01 extend them.
- Root scripts fan out with `--workspaces --if-present`: a workspace opts in by defining the script. `db:reset` → server; `gen:api` → server then web.
- `concurrently` is the dev runner; `typescript` is hoisted at the root.
