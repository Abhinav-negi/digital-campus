# FS-13 · Parity leftovers from QA-03b
**Reads:** docs/PARITY.md "Filed (QA-03b)"
**Owns:** `web/src/routes/admin/classes/List.tsx`, `web/src/routes/student/class/Board.tsx` (exam row spacing only), `web/src/styles/*.css`

## Do
- Admin class cards at 390: chips on their own line under the title.
- Student Exams rows ~6px taller than PROTO: match the PROTO row padding.
- Teacher class Board reuses the student board (TE-05a design, D-intentional): no change, keep it listed as intentional.

## Done when
- [ ] 390px screenshots of admin Classes and student Exams match PROTO spacing. Web checks green.

## Notes
- Admin Classes: card header row is now `row between wrap` (title + chips) in `List.tsx`; at 390 the chips drop under the title when they don't fit (shots/fs13-before|after-admin-m.png).
- Student Exams: measured row heights in headless Chrome, app == PROTO at 390 (126/129/128px) and 1280 (81/81/80px); markup and `.list` CSS are identical, so the "~6px" no longer reproduces. No change made (shots/fs13-*-exams-*.png).
- Teacher Board reuse recorded under PARITY.md "Intentional"; no code change.
- Checks: typecheck + web tests + web build all green.
