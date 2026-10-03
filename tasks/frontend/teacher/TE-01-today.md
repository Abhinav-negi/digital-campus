# TE-01 · Teacher Today: sessions, cancel/postpone, clashes, allotments
**Reads:** SPEC §7.4 · ARCH §2 D7, D10–D11 · PROTO `teacher.html:178-202`, `:288-294` (past session) · API CS-11, CS-05, CS-03 (decline)
**Owns:** `web/src/routes/teacher/{Today,SessionActions,PastSession}.tsx`, `web/src/routes/teacher/queries.ts` (create)

## Do
- Greeting, "n sessions today · k done", the "Fill a past session" button (today or yesterday).
- A session card per item (time block, subject, class, room; change badges "Cancelled/Moved by CR Riya"; Done ✓ + Edit; **Take attendance**).
- **On each own session:** "⋯" → Cancel (note) · Postpone (later today: new time; or another date + time + room) → `POST /classes/:id/changes`.
- **A clash banner** on clashing sessions: "Overlaps with {other subject} by {teacher} in {class} at 13:00. Who's taking it?" with [Keep mine] (dismiss locally) · [Cancel mine] · [Postpone mine].
- **Allotment card** for new `subject-allotted` notifications: "Riya (CR) added you as teacher of Data Structures in CSE · 2nd year · A" → [Got it] · [Not me].
- Coming up (next 3) → link to Upcoming.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] A seed clash shows the banner for both teachers; cancelling one clears it on refresh; Not me removes the class.

## Notes
