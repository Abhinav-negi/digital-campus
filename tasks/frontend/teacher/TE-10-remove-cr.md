# TE-10 · Remove / replace a CR from the Students tab
**Reads:** docs/DEMO.md "Failures (re-run)" · API CS-02 (`PUT /classes/:id/cr`, max 2)
**Owns:** `web/src/routes/teacher/class/StudentsTab.tsx`

## Do
- A CR row gets "Remove CR" (PUT /cr with the set minus them). With 2 CRs, "Make CR" on a third asks which one to replace instead of silently dropping the oldest.

## Done when
- [ ] Teacher removes a CR → that student's Edit disappears; making a third CR asks whom to replace. Web checks green.

## Notes
