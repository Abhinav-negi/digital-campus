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
