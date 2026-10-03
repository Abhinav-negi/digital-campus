# ST-07 · Commons: Board
**Reads:** SPEC §9.2 · PROTO `student.html:239-354` (rCommons, KIND, bpCard, cBoard, composeSheet/Form, bpSheet, report, msgPost) · API CM-02, CM-03, CM-06 (post message), CM-07
**Owns:** `web/src/routes/student/commons/{CommonsPage,Board,BoardCard,Compose,PostSheet,ReportSheet}.tsx`

## Do
- The Commons header (tabs Board · Build · People, "+ Post", a FAB on mobile) + the **admin-visibility notice** line (D2): "Admins can see Commons activity, including messages, for safety."
- The feed with search, branch select and kind chips; cards with kind colours; cursor "Show more".
- The "What do you need?" picker → the per-kind form (honesty and safety notes on Gig and Market).
- The post sheet with every per-kind action (answer, interested, assign, done + thank, claim, confirm, mark sold/given/returned, message the seller/finder → opens the thread in Me), Report.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] Every action in the PROTO sheet works against the API; the 5/day cap shows its toast.

## Notes
