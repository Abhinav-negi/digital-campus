# ST-09 · Commons: People + person sheet + message request
**Reads:** SPEC §9.4, §9.7 · PROTO `student.html:433-473` · API CM-01, CM-06, CM-07 (block)
**Owns:** `web/src/routes/student/commons/people/*`

## Do
- Search + branch + year selects + availability chips + "Happy to help juniors"; cards with the availability badge; Show more.
- The person sheet: track record, headline, skills, links with the stat line (stats omitted for now: GitHub/LeetCode deferred), Working on, the **Ask** button (hidden in Focus → "In focus mode until …"), Block / Report.
- The ask sheet → a request (the 5/day toast).

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] A Focus profile shows no Ask button; a request appears in the recipient's Me.

## Notes
- Done: `commons/people/People.tsx` (list + filters + person sheet + ask + report + block), wired in CommonsPage's People tab. Ordering/round-robin is server-side; the UI just pages with "Show more".
- The sheet reads `availability`/`focusUntil`/`canAsk`/`conversation` from GET /commons/profiles/{id}: self, Focus (no Ask, "In focus mode until …"), an existing conversation (status chip), else Ask.
- Ask posts /commons/conversations; the 5/day cap and IN_FOCUS errors toast the server message via FormSheet. Block = POST /commons/blocks; Report = POST /commons/reports targetType 'profile'.
- ReportSheet is board-post-only (hardcoded targetType 'board', post wording), so People has its own small reason list (Spam / Unsafe or prohibited / Harassment / Other). Follow-up: generalise ReportSheet to a targetType prop.
- "Working on" shows project chips, not links (no project sheet yet; CM-04 Build tab). `.lnk` and `.clamp` classes don't exist in styles, so links use `.row`; the headline isn't clamped. Year filter is fixed at 1-4.
- S10 orchestrator: live curl verified (Focus s15 canAsk false + IN_FOCUS; s1→s10 request shows in s10's incoming). Replaced People's own report sheet by generalising commons/ReportSheet (title/targetType/targetId/reasons); PostSheet updated.
