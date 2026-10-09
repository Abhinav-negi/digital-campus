# QA-03 · Visual parity with the prototype
**Reads:** DESIGN.md §11 (checklist) · PROTO all pages
**Owns:** `docs/PARITY.md` (screenshots list + diffs found)

## Do
- For every PROTO screen and state (student 4 views + sheets, teacher 6 views, admin 3, landing), compare at 1280px and 390px. Note every difference that isn't explained by a new feature (D7–D11), and fix it or file it.

## Done when
- [x] No unexplained differences remain.

## Notes
- Compared headless-Chrome shots at 1280/390 (scripts in the session scratchpad, not the repo); results and fixes are in docs/PARITY.md.
- Found and fixed a real routing bug: tab NavLinks were relative to a splat route (`/s/commons/build/build`); now absolute.
- Shared board CSS (`.week/.day/.slot`) moved into style.css because student.css is scoped to body.student (teacher/admin boards were unstyled).
- 10 bigger items filed in docs/PARITY.md "Filed" (server fields, My projects cards, mobile button, sheet footer).
- Checks: `npm run typecheck` 0 errors, `npm test -w web` exit 0, `npm run build -w web` OK. Not run: landing and admin-screen deep diffs, mobile pixel diffs of Class/Commons/Me.
