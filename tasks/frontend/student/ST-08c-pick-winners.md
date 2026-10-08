# ST-08c · Commons Build: owner picks challenge winners
**Reads:** SPEC §9.3 · API CM-05 (`canPickWinners`, `PUT /commons/challenges/{id}/winners`)
**Owns:** `web/src/routes/student/commons/build/ChallengeSheet.tsx`

## Do
- When `canPickWinners` is true (owner-judged, ended), each submission gets a select toggle and a "Save winners" button → `PUT …/winners`; the winner card then shows them.

## Done when
- [x] Owner of an ended owner-judged challenge picks a winner → the grid's winner chip names them (curl + typecheck).

## Notes
- Origin: ST-08b (S11). The API already supports it; only the UI is missing.
- Done: ChallengeSheet shows a Pick/Winner toggle per submission plus "Save winners" (PUT) when `canPickWinners`; selection starts from current winners. Verified live on ch3 (PUT winners then GET list names them). Ids come from `Byline.id`.
- S11 orchestrator: PUT re-saved the seed winner (weak proof); empty userIds → 422 and the UI disables Save on an empty pick, so accepted.
