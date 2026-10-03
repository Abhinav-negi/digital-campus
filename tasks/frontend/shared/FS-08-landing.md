# FS-08 · Landing page
**Reads:** PROTO `index.html:46-121` (hero, roles, how it works, two spaces, Commons, flagship)
**Owns:** `web/src/routes/landing/*`

## Do
- Port the sections verbatim. The role cards link to `/login`. Remove the "Try the invite" demo and "Reset demo data" (they were prototype-only). Branch chips come from `GET /branches` when logged in, else from a static list.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] Side-by-side parity with `index.html`.

## Notes
- ✅ S03: parity checked by headless-Chrome screenshots vs `index.html` at 1280/390 (only diff: random dicebear cast backgrounds; "Try the invite" removed as asked).
- Body class `landing` activates `:where(.landing)` styles. The Admin link and the flagship "See the project" go to `/login` (logged-out visitors land there anyway).
- Branch chips are static `CSE IT ECE ME IE`; FS-05/auth swaps in `GET /branches`. Possible follow-up: redirect logged-in users from `/` to `homeOf(me)`.
- Tests use `node:test` + `renderToString` (no vitest/jsdom). The web `test` script now globs `src/**/*.test.ts(x)` through the `tsx` loader (tsx is hoisted from server).
