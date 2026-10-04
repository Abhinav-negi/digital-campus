# CS-10 · Attendance: rotating check-in code
**Reads:** ARCH §9.5 · SPEC §8 (check-in code) · PROTO `teacher.html:224-273` (ring UI behaviour)
**Owns:** `server/src/modules/attendance/code.ts`, `server/test/checkin.test.ts`

## Endpoints
- `POST /attendance-sessions/:id/code` (teach): generate `codeSecret`, `codeOpenedAt=now`, mark everyone absent-pending → `{windowEndsAt}`.
- `GET /attendance-sessions/:id/code` (teach): `{code, secondsLeft, checkedIn:[ids], flagged:[ids]}`, polled every 2s.
- `POST /checkin {code}` (student): find the open session (≤2 min old) for one of the student's subjects today whose current or previous 20-second code matches; mark present `source=code`, `deviceId=req.deviceId`. If **another account already checked in from the same device** in this session → set `flagged` on both (never reject). Wrong or expired → 422 "That code didn't match".
- The teacher's `PUT` save (CS-09) stays final.

## Done when
- [ ] Tests (fake clock): the current and previous window are accepted, the one before is rejected; after 2 min → rejected; same device for two students → both flagged and both present.

## Notes
- Done S05. 4-digit HMAC code per 20s step, 2-minute window, current + previous step accepted (timing-safe). Guess limit 5/min per student, not per IP (one classroom Wi-Fi; in-memory `ponytail:`). Same device for two accounts → both flagged, both present. Opening the code resets everyone to absent-pending (PROTO); the teacher's PUT closes it.
- TE-03: `POST …/:id/code`, poll `GET …/:id/code` every 2s (`secondsLeft`, `checkedIn`, `flagged`), save with `PUT`.
