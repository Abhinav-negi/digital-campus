# ST-08b · Commons Build: challenges
**Reads:** SPEC §9.3 · PROTO `student.html:405-432` · API CM-05
**Owns:** `web/src/routes/student/commons/build/{Challenges,ChallengeSheet,NewChallenge}.tsx`

## Do
- Challenges grid + sheet (submissions sorted by likes, like toggle, submit link, winner chip), New challenge. Mount it as a section of ST-08a's BuildPage (one import + one line).

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] Liking and submitting work; the winner chip shows after the end date.

## Notes
- Done: Challenges.tsx (grid + `Winners` chip), ChallengeSheet.tsx (likes toggle, submit form, `canSubmit` from API), NewChallenge.tsx; mounted in BuildPage (3 imports, 2 state lines, 1 section line, 2 sheets).
- Submission URL is rendered as a link only if `/^https?:\/\//`; otherwise plain text. Like button disabled when `!live`.
- Winner chip reads `winners[]` on the card/detail (server computes it; seed ch3 is ended + owner-picked).
- Not built: owner "pick winners" UI (`canPickWinners` + PUT /commons/challenges/{id}/winners), Report.
- Verified live (port 3101): like toggles on/off with count, new submission listed sorted by likes.
- S11 orchestrator: live curl verified (like toggles 2→3→2; submission sorted; ch3 winners). BuildPage needed 2 state + 2 sheet lines (accepted). Pick-winners UI → ST-08c.
