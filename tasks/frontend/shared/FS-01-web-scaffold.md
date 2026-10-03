# FS-01 · Web scaffold
**Reads:** ARCH §5 (web row), §6 (web/), §10
**Owns:** `web/package.json`, `web/vite.config.ts`, `web/index.html`, `web/tsconfig.json`, `web/src/{main,router}.tsx`, `web/public/*`

## Goal
An empty but correctly wired SPA: routing, data layer, PWA, fonts, dev proxy.

## Do
- Vite + React 19 + TS; react-router with lazy routes for `/`, `/login`, `/invite/:token`, `/s/*`, `/t/*`, `/a/*` (placeholder pages).
- TanStack Query client (staleTime 30s, retry 1, refetchOnWindowFocus).
- `vite-plugin-pwa`: manifest (name "Digital Campus", theme `#4F46E5`, icons from the brand mark), precache the app shell, `navigateFallback`.
- Dev proxy `/api` → `http://localhost:3000`. `@fontsource/josefin-sans` 300–700.
- Route guard: fetch `/auth/me`; no session → `/login`; wrong area → the user's home area.

## Done when
- [ ] `npm run dev -w web` serves; Lighthouse marks it installable; `npm run build -w web` succeeds, and the initial JS is under 300 KB gzip (SPEC §13.4).

## Notes
- S02 ✅: vite 8.3, react-router 8.4, vite-plugin-pwa 1.3. Initial JS 106 KB gzip. No Lighthouse on this machine, so installability was checked by hand: manifest (name, standalone, 192/512 icons) + generated `sw.js`.
- Placeholder pages are inline `lazy` routes in `router.tsx`; area tasks swap in `import('./routes/<area>')`. The guard uses a plain fetch of `/auth/me` (`ponytail:` → typed client in FS-05). Home: `/s` student, `/a` a chief with no classes, else `/t`.
