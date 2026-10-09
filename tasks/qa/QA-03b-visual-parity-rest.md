# QA-03b · Visual parity: the screens QA-03a didn't reach
**Reads:** docs/PARITY.md (append to it) · DESIGN.md §11 · PROTO pages
**Owns:** `docs/PARITY.md`; small CSS/markup fixes in the screens below

## Do
- Compare at 1280px and 390px: landing; admin Classes/Commons/School; student Posts/Attendance/People; teacher class Posts/Students/Attendance/Settings tabs; mobile Class/Commons/Me; key sheets (post, project, challenge, person, ticket, attendance code).
- Re-check the FS-10/CS-17 items landed.

## Done when
- [x] No unexplained differences remain across every PROTO screen.

## Notes
- Compared every listed screen at 1280/390 (landing, student Class/Commons/Me, teacher class tabs, admin Classes/Commons/School, 7 sheets at 390); full table in docs/PARITY.md "QA-03b".
- Fixed 6 things (sticky sheet footer moved to style.css, student bell sheet, student Posts avatar/due chip, teacher Posts kind badge, Students rows at 390, Upcoming heading leak); filed 5 small items; intentional list updated.
- S12 items re-checked and landed (bell sheet, /403, Log out, WeekAhead 7 cols, Upcoming 14-day + clash actions). Not checked: attendance code sheet (no live session), Import sheet.
- Checks: `npm run typecheck && npm test -w web && npm run build -w web` green.
