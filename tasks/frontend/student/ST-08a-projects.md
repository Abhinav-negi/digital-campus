# ST-08a · Commons Build: flagship + projects
**Reads:** SPEC §9.3 · PROTO `student.html:356-404` · API CM-04
**Owns:** `web/src/routes/student/commons/build/{BuildPage,Flagship,Projects,ProjectSheet,NewProject}.tsx`

## Do
- The flagship hero (members with branch codes, Ask to join, Open issues, Repo, Details); a featured/community strip; All projects grid.
- The project sheet (roles, team, join requests for the owner, post update, contribution log); New project.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] Join → the owner accepts → the member is shown.

## Notes
- Done S07. Build tab = `BuildPage` (queries `['commons','projects']`; flagship, featured strip, all grid; the ST-08b challenges spot is a comment at the bottom). Project detail query key `['commons','projects',id]`, so one invalidation refreshes everything.
- Join is one tap with no note (as in PROTO); the API accepts an optional note, a later add. `JoinCta` (Projects.tsx) is shared by hero, cards' sheet.
- Generated `ProjectCard[]` items are typed nullable, so BuildPage filters nulls; flagship may be null (hero hidden).
- Owner sees requests (Accept/Decline); members see Post update. No Report/edit/delete UI (not in PROTO). Team rows are not clickable to profiles (no person sheet in web yet).
- Verified live (curl, UI's exact requests): join 201 -> owner detail shows request -> accept 200 -> requester `me: member`, team lists them; update 201; create 201.
- S10 orchestrator: live curl verified (join pr0 → owner accepts → member listed). Follow-up for QA/ST-08b: team rows could open People's person sheet (it exists now).
