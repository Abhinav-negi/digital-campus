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
- From CM-06/07 (S07): `POST /commons/board-posts/:id/message` accepts gig/market/lost/found (board.ts's `message` action only lists market/lost; trust the endpoint). Report reason "Academic dishonesty" only on gigs (422 otherwise).
- ST-07b done: PostSheet fetches GET /commons/board-posts/:id and gates every button on its `actions` array; ReportSheet posts /commons/reports (targetType 'board'). Status change is PATCH. Gig "Mark done + Thank" = POST /done (server thanks assignee). Message navigates to `/s/me/messages/<conversationId>` (404 until ST-10b). No unit test (UI only, no DOM test setup). typecheck + web tests pass.
- Orchestrator (S09): verified by typecheck + web tests + gating matches server `actions` (board.ts:161). Not clicked through in a browser: QA-02 covers it.
