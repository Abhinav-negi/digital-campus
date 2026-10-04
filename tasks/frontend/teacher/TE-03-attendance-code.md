# TE-03 · Attendance: check-in code mode
**Reads:** SPEC §8 (code) · PROTO `teacher.html:224-229`, `:256-273` (ring + tick), CSS `:48-51` · API CS-10
**Owns:** `web/src/routes/teacher/attendance/CodeMode.tsx`

## Do
- The Code tab → `POST …/code` → the ring with the 4-digit code and a 20s countdown (the code comes from `GET …/code` polled every 2s, never generated client-side), "n of N checked in", tiles flip to present as students check in ("Waiting" before), the same-device warning badge + note "Flagged, not rejected."
- Tap any tile to correct; Save as in TE-02.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] A student checking in from the student app flips the tile within 2s.

## Notes
