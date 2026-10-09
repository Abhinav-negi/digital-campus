# TE-10 · Remove / replace a CR from the Students tab
**Reads:** docs/DEMO.md "Failures (re-run)" · API CS-02 (`PUT /classes/:id/cr`, max 2)
**Owns:** `web/src/routes/teacher/class/StudentsTab.tsx`

## Do
- A CR row gets "Remove CR" (PUT /cr with the set minus them). With 2 CRs, "Make CR" on a third asks which one to replace instead of silently dropping the oldest.

## Done when
- [ ] Teacher removes a CR → that student's Edit disappears; making a third CR asks whom to replace. Web checks green.

## Notes
- StudentsTab.tsx only. CR rows get "Remove CR" (PUT /cr with the set minus them); non-CR "Make CR" adds directly with <2 CRs, else opens a Sheet listing the 2 CRs ("Who should X replace?") and PUTs the swapped set.
- Server `PUT /classes/:id/cr` requires 1-2 userIds (`.min(1)`), so an empty set is refused: the sole CR's "Remove CR" is disabled with a tooltip (replace via Make CR instead). Server untouched.
- Visual (headless Chrome, teacher meera, c1): start CRs s1+s2; Make CR on a 3rd student showed the Riya/Myra prompt; picking Myra swapped her out; Remove CR dropped one, leaving the sole CR's button disabled. c1 CR restored to s1 via API (200).
- Checks: typecheck, web tests, web build all green.
