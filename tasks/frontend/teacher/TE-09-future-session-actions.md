# TE-09 · Cancel/postpone a class on a future date
**Reads:** docs/DEMO.md F3b · ARCH §2 D11 · API CS-05 (changes), CS-11 (upcoming)
**Owns:** `web/src/routes/teacher/Upcoming.tsx` (schedule rows), `web/src/routes/teacher/SessionActions.tsx` (reuse), `web/src/routes/teacher/ClashBanner.tsx`

## Do
- Teacher Upcoming lists my sessions for the next 14 days (from the schedule API); a clash shows the red badge + "Who's taking it?" with Cancel / Postpone (the Today `SessionActions`).
- A clash notification link lands on that day in Upcoming.

## Done when
- [ ] CR moves a class onto tomorrow over another teacher's slot → the teacher sees the clash in Upcoming and cancels it → the clash clears for both. Web checks green.

## Notes
- Upcoming now has "Your classes · next 14 days": `useMySchedule` (queries.ts) = GET /classes/:id/schedule (CS-05) per teaching class, keeping items where teacher = me; clash teacher names come from the other item in the same payload. Reuses ClashBanner/SessionActions (prop type widened to `ClashSession`; Today's TodaySession still fits). `useSessionChange` now invalidates all `['me']`.
- Moved items cancel/postpone against `change.date` (the original date), not the day shown, else the server 422s ("slotId must be a slot ... on that date"). Today.tsx passes t.date for moved items (same latent bug, not mine). Extras/events (no slotId) get no actions.
- Live: CR moved tt11 (Arjun) + tt12 (David) from Thu 15 Oct onto Sat 10 Oct 14:00/14:30 -> David saw Clash in Upcoming, Cancel -> API clash [] for both. Changes undone via DELETE. Shots: scratchpad/pw/shots/te09-*.png.
- SERVER CHANGE NEEDED (clash notification link): `linkFor` in server/src/modules/me/notifications.ts has no `clash` case, so link is null (payload has date, no classId). Add before the final return: `if (type === 'clash') return s ? '/s' : `/t/upcoming?date=${p.date}`;` Upcoming already scrolls to/outlines `?date=`.
- Checks: typecheck, web tests, web build green.
