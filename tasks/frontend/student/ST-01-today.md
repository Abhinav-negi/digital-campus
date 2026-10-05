# ST-01 · Student Today
**Reads:** SPEC §7.3 · ARCH §2 D9, D11 · PROTO `student.html:147-177` · API CS-11 `GET /me/today`, CM-08 `GET /commons/card`
**Owns:** `web/src/routes/student/Today.tsx`, `web/src/routes/student/queries.ts` (create; other ST tasks append their hooks in their own files)

## Do
- Greeting + date; cancellation banners (who posted, CR tag); the hero card (Happening now / Up next / No more classes); today's schedule list with Cancelled / Moved / **Clash** badges.
- Attendance at a glance (bars + "Safe by N" text from the API); Coming up (14d); New from teachers (opening one marks it seen via ST-06); the From the Commons card with "Next · i of n" rotation.
- **D9:** if `empty.timetable`, show `<CrWillAdd what="timetable">` in place of the hero and schedule (the CR sees "Add timetable" → ST-03).

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] With seed data it matches the prototype; with an empty class it shows the placeholders.

## Notes
- S08 ✅ Hooks are in `student/queries.ts` (`useToday`, `useCommonsCard`). The Commons card links to `/s/commons` and ignores `refId` until ST-07 routes exist. Unread posts link to `/s/class/posts` without marking them seen (ST-06).
- The "(CR)" tag is a guess (author ≠ slot teacher). CS-13 adds `author.isCr` to replace it.
