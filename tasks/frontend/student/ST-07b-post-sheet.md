# ST-07b · Commons: post sheet actions + report
**Reads:** SPEC §9.2 · PROTO `student.html:305-354` (bpSheet, report, msgPost) · API CM-03, CM-06 (post message), CM-07
**Owns:** `web/src/routes/student/commons/{PostSheet,ReportSheet}.tsx`

## Do
- The post sheet with every per-kind action: answer, interested, assign, done + thank, claim, confirm, mark sold/given/returned, message the seller/finder (opens the thread in Me).
- Report → the report sheet.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] Every action in the PROTO sheet works against the API.

## Notes
