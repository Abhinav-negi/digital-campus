# CS-15 · Tell the student when a check-in code is open
**Reads:** SPEC §8 · API CS-10, CS-11 · `server/src/modules/me/today.ts`
**Owns:** `server/src/modules/me/today.ts` + its test; `web/src/routes/student/class/CheckIn.tsx`

## Do
- `/me/today` (students): `codeOpen: { sessionId, subject: { id, name } } | null` = a code session in one of my classes whose window hasn't ended and where I'm not checked in yet.
- `npm run gen:api`; `CheckIn` renders only when `codeOpen` is set (Today + My attendance tab), and names the subject.

## Done when
- [x] Test: no open session → `codeOpen: null`; teacher opens a code → set; after the student checks in → null again.

## Notes
- Origin: ST-06 (S10). Without this flag the "Enter class code" card shows all the time (SPEC says only while a code is open). Run after CS-13 (both edit me/today.ts).
- Done: `/me/today` (students) has `codeOpen` via one extra `attendanceSession.findMany` (same where as POST /checkin, plus `records: none present for me`), then `isOpen()` from attendance/code.ts picks the live one.
- Test "CS-15" in today.test.ts: null, roll session still null, teacher opens code, set, student POST /checkin, null.
- `CheckIn` reads `useToday()` (key `['me','today']`, one request) and returns null when `codeOpen` is null; eyebrow shows the subject name. The "marked present" card still shows after success (done state checked first).
- Only students' first-listed open session is returned if several are open at once.
