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
