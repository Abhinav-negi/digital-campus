# QA-02b · Re-run the lab demo after the fixes
**Reads:** docs/DEMO.md (append a "Re-run" section) · tasks/qa/QA-02-lab-demo.md (the 10 steps)
**Owns:** `docs/DEMO.md`

## Do
- Reseed first (`npm run db:seed -w server`, nobody else on the dev DB). Re-run the 10 steps in the browser, without the S12 workarounds (code opens from the UI; clash handled from Upcoming).

## Done when
- [ ] Every step passes, or new failures are filed as tasks in INDEX.

## Notes
- Re-run on a reseeded DB, real UI only, no workarounds: all 10 steps PASS; F1-F7 are fixed (Make CR from Students tab, code opens from the UI, clash handled via bell -> /t/upcoming?date=, teacher at /s/commons gets the 403 page, past term shows "read-only" with no Edit, Log out on Me, 24 logins from one IP without a block).
- Result and evidence per step are in docs/DEMO.md "Re-run (QA-02b)".
- No new blocking failures; minor: Make CR is additive (two CRs, no way to remove one), the "Set up your class" sheet still re-opens and covers Edit until dismissed.
- Gotchas for reruns: invite links come from api.log; the login limiter no longer needs cookie caching.
- Nothing in INDEX was changed (no new tasks required).
