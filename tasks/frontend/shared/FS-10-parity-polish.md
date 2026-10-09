# FS-10 · Parity polish (web only)
**Reads:** docs/PARITY.md "Filed" 5–10 · PROTO cited there
**Owns:** `web/src/routes/student/class/edit/{History,TipSheet}.tsx`, `web/src/routes/student/me/MePage.tsx`, `web/src/routes/teacher/SessionActions.tsx`, `web/src/styles/teacher.css`, `web/src/ui/Sheet.tsx`, the "New from teachers" sort in `web/src/routes/{student,teacher}/Today.tsx`

## Do
5. Edit history: relative time, actor first ("Riya Patel · Added exam").
6. Me: "My projects" as the Build project cards; student ID in the profile header.
7. Teacher Today ≤720px: Take attendance full width next to the clash "…" menu.
8. `ui/Sheet`: sticky footer so actions stay visible on short screens.
9. CR "Set up your class" TipSheet only when the board is empty.
10. "New from teachers": oldest first, as PROTO.

## Done when
- [ ] Each item visible in a 1280px/390px screenshot; web tests, typecheck, build green.

## Notes
- Done 5,6(projects),7,8,9,10 in Owns files; typecheck/test/build green. 6 student ID NOT done: no student-facing field has studentIdNo (User, PersonProfile lack it; ClassMember is staff-only) -> needs server (add to PersonProfile when self).
- 6: Me reuses ProjectCard + ProjectSheet, filters /commons/projects (flagship+featured+all) by me==='member'; profile.projects chips dropped.
- 8: sticky `.sheet .actions` lives in teacher.css so it only applies to teacher/admin sheets; Sheet.tsx unchanged. Footer sticks mid-sheet when a field (file input) follows the actions in FormSheet.
- 9: ClassPage (not owned) still opens TipSheet; TipSheet now returns null unless all 5 board lists are empty (own query, key [..,'board','tip']). 10: student Today only (teacher Today has no such section).
- Not visually checked: History (5), TipSheet (9): /s/class crashes in Board.tsx:134 (`f.createdAt.slice` undefined, in-flight item-4 change from another task, server not returning createdAt).

