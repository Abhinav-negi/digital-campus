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
- Done. Code tab in `AttendancePage` (state `code` + `fixed` tap overrides); `CodeMode.tsx` = ring/count/flag note only. Absent = not in `checkedIn` unless the teacher tapped; Save reuses TE-02's `useSaveAttendance` unchanged.
- `queries.ts`: `useOpenCode` (POST, fired on tab open; reopening resets everyone to pending) and `useCode` (GET, `usePoll` 2s). The page and `CodeMode` share one query key, so one poll feeds both.
- `Roster` got optional `waiting` / `flagged` props ("Waiting" while the window is open, "Same device" badge). Ring counts down locally from the server's `secondsLeft` between polls.
- Live API checked on a scratch server: open, code, check-in, same-device flags (s33+s34 both present and flagged), PUT save. Note a GET after save returns `code: null`.
- No automated test: the logic is thin glue over the API; the live curl run covers it.
- S11 orchestrator: live curl verified (check-in → next GET shows it; shared X-Device-Id → flagged; PUT saves method code). Fixed: re-entering the Code tab re-POSTed …/code, which deleteMany's the session's check-ins server-side; CodeMode now GETs first and only POSTs on 409 NO_CODE.
