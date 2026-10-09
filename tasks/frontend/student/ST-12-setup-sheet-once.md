# ST-12 · "Set up your class" sheet: once per session
**Reads:** docs/DEMO.md "Failures (re-run)" · FS-10 Notes (TipSheet shows only on an empty board)
**Owns:** `web/src/routes/student/class/edit/TipSheet.tsx`

## Do
- After the CR dismisses it, don't reopen it this session (sessionStorage, wrapped in try/catch); a "Setup tips" link next to Edit reopens it.

## Done when
- [ ] Dismiss → navigate away and back → sheet stays closed; Edit is reachable. Web checks green.

## Notes
