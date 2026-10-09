# TE-09 · Cancel/postpone a class on a future date
**Reads:** docs/DEMO.md F3b · ARCH §2 D11 · API CS-05 (changes), CS-11 (upcoming)
**Owns:** `web/src/routes/teacher/Upcoming.tsx` (schedule rows), `web/src/routes/teacher/SessionActions.tsx` (reuse), `web/src/routes/teacher/ClashBanner.tsx`

## Do
- Teacher Upcoming lists my sessions for the next 14 days (from the schedule API); a clash shows the red badge + "Who's taking it?" with Cancel / Postpone (the Today `SessionActions`).
- A clash notification link lands on that day in Upcoming.

## Done when
- [ ] CR moves a class onto tomorrow over another teacher's slot → the teacher sees the clash in Upcoming and cancels it → the clash clears for both. Web checks green.

## Notes
