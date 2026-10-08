# ST-08c · Commons Build: owner picks challenge winners
**Reads:** SPEC §9.3 · API CM-05 (`canPickWinners`, `PUT /commons/challenges/{id}/winners`)
**Owns:** `web/src/routes/student/commons/build/ChallengeSheet.tsx`

## Do
- When `canPickWinners` is true (owner-judged, ended), each submission gets a select toggle and a "Save winners" button → `PUT …/winners`; the winner card then shows them.

## Done when
- [ ] Owner of an ended owner-judged challenge picks a winner → the grid's winner chip names them (curl + typecheck).

## Notes
- Origin: ST-08b (S11). The API already supports it; only the UI is missing.
