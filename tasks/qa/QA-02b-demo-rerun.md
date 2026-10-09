# QA-02b · Re-run the lab demo after the fixes
**Reads:** docs/DEMO.md (append a "Re-run" section) · tasks/qa/QA-02-lab-demo.md (the 10 steps)
**Owns:** `docs/DEMO.md`

## Do
- Reseed first (`npm run db:seed -w server`, nobody else on the dev DB). Re-run the 10 steps in the browser, without the S12 workarounds (code opens from the UI; clash handled from Upcoming).

## Done when
- [ ] Every step passes, or new failures are filed as tasks in INDEX.

## Notes
