# TE-01a · Teacher Today: sessions + cancel/postpone
**Reads:** SPEC §7.4 · ARCH §2 D10 · PROTO `teacher.html:178-202`, `:288-294` (past session) · API CS-11, CS-05
**Owns:** `web/src/routes/teacher/{Today,SessionActions,PastSession}.tsx`, `web/src/routes/teacher/queries.ts` (create)

## Do
- Greeting, "n sessions today · k done", the "Fill a past session" button (today or yesterday).
- A session card per item (time block, subject, class, room; change badges "Cancelled/Moved by CR Riya"; Done ✓ + Edit; **Take attendance**).
- On each own session: "⋯" → Cancel (note) · Postpone (later today: new time; or another date + time + room) → `POST /classes/:id/changes`.
- Coming up (next 3) → link to Upcoming.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] Postponing a session moves it on Today and on the students' Today.

## Notes
