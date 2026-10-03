# FS-08 · Landing page
**Reads:** PROTO `index.html:46-121` (hero, roles, how it works, two spaces, Commons, flagship)
**Owns:** `web/src/routes/landing/*`

## Do
- Port the sections verbatim. The role cards link to `/login`. Remove the "Try the invite" demo and "Reset demo data" (they were prototype-only). Branch chips come from `GET /branches` when logged in, else from a static list.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] Side-by-side parity with `index.html`.

## Notes
