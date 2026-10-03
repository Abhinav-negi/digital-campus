# ST-04 · Week-ahead changes, events, clashes (CR)
**Reads:** ARCH §2 D10–D11, §9.3 · PROTO `student.html:539-550` (slotSheet) · API CS-05
**Owns:** `web/src/routes/student/class/edit/WeekAhead.tsx`

## Do
- The "This week & next" view: 14 days of the computed schedule (`GET /classes/:id/schedule`), each day a column (a list on mobile).
- Tapping an item → a sheet: Cancel · Move (time, room, optional other date) · Undo existing change · note for the class.
- "+ Add" on a day → Extra class (subject, time, room) or **Event** (title, time, place, note).
- A clash shows a red "Clash" badge on both items with text: "Both teachers have been asked who's taking it."

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] Moving a slot to tomorrow shows on both days correctly; adding a 13:00 extra over a 13:00 slot shows Clash on both.

## Notes
