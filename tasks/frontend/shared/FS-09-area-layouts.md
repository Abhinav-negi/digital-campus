# FS-09 · Student + teacher area layouts (added S08, orchestrator)
**Owns:** `web/src/routes/{Soon.tsx,student/index.tsx,student/routes.ts,teacher/index.tsx,teacher/routes.ts}`, the `/s` `/t` lines in `web/src/router.tsx`

## Done
- `/s` and `/t` render AppShell + `<Outlet/>`; children live in `<area>/routes.ts`, each pointing at `Soon.tsx` until its task lands.
- **Rule for ST/TE tasks:** swap only your own line's `lazy` in `<area>/routes.ts` to `() => import('./<YourPage>')` (the page exports `Component`). Need a new path? Add one line.
- Left out until needed: the FAB (ST-07a / TE-08 wire it), bell `onBell` (ST-10b), the admin layout (AF-01).
