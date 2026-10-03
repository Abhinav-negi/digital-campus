# FS-04 · App shell (rail + bottom nav)
**Reads:** DESIGN.md §2, §4 · PROTO `student.html:67-86`, `:657-665`, `teacher.html:79-106`, `:134-138`, `admin.html:20-46`
**Owns:** `web/src/ui/AppShell.tsx`

## Do
- Props: `personality: student|teacher`, `nav:[{to,label,icon}]`, `railFooter`, `fab?`. It sets `document.body.className`.
- The rail with the brand mark at ≥861px; the bottom nav at ≤860px; the notification bell with an unread count (polls `/me/notifications` every 30s).
- Staff with `isAdmin` see an "Admin" link in the rail footer; admins in `/a` see "Teacher app".
- Logout in the rail footer.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] Both breakpoints match the prototype; the active nav state follows the route.

## Notes
- ✅ S03: headless-Chrome screenshots of `/ui/shell/{student,teacher,admin}` (dev demo, `ui/ShellDemo.tsx`) match `{student,teacher,admin}.html` at 1280/390. Demo-only footer links are dropped.
- Deviations: `personality` also takes `'admin'` (body `teacher admin`); `isAdmin?` and `onBell?` props were added. The bell shows for every personality, so `.topbar/.bell` moved from student.css to style.css.
- Nav: `nav[0]` matches its exact path only; the other items stay active on sub-routes. `unreadQuery` (plain fetch, 30s poll) is for FS-05 to swap out.
- Tests: `node:test` + jsdom (devDep). Follow-ups: ST-10 wires `onBell` and adds a mobile logout for students (the prototype has none); hide "Teacher app" for a chief admin with no classes.
