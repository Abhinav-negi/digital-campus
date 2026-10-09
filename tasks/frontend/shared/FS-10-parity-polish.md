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
