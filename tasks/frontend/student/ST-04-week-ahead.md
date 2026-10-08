# ST-04 · Week-ahead changes, events, clashes (CR)
**Reads:** ARCH §2 D10–D11, §9.3 · PROTO `student.html:539-550` (slotSheet) · API CS-05
**Owns:** `web/src/routes/student/class/edit/WeekAhead.tsx`

## Do
- The "This week & next" view: 14 days of the computed schedule (`GET /classes/:id/schedule`), each day a column (a list on mobile).
- Tapping an item → a sheet: Cancel · Move (time, room, optional other date) · Undo existing change · note for the class.
- "+ Add" on a day → Extra class (subject, time, room) or **Event** (title, time, place, note).
- A clash shows a red "Clash" badge on both items with text: "Both teachers have been asked who's taking it."

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] Moving a slot to tomorrow shows on both days correctly; adding a 13:00 extra over a 13:00 slot shows Clash on both.

## Notes
- Built `WeekAhead.tsx` (mounted after `<WeekEditor>` in ClassPage): 14-day grid via `.week/.day/.slot` classes; item sheet (cancel/move/note/undo) and add sheet (extra/event). Item `change.date` is the original date, so moves of an already-moved item post on that date; undo uses `change.id`.
- Verified live (CR 25csea001, class c1): move tt14 Fri->Sat gave old day `off` + `change.kind=moved`, new day item with `change.kind=moved`; 13:00-14:30 extra over the 14:00 lab returned both with non-empty `clashWith`. Seed has no 13:00 slot, so overlap used 14:00.
- Gotcha: days grid is 5 columns on desktop (existing `.week` css), so 14 days wrap; QA-03 may want a 7-col rule. Test: `weekAhead.test.ts` (dateRun). typecheck/test/build pass; db re-seeded.
