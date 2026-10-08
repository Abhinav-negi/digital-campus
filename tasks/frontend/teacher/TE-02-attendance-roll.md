# TE-02 · Attendance: tap the absent
**Reads:** SPEC §8 · ARCH §9.5 · PROTO `teacher.html:204-254`, `:275-286`, CSS `:33-47` · API CS-09
**Owns:** `web/src/routes/teacher/attendance/{AttendancePage,Roster}.tsx`

## Do
- `/t/attend/:sessionId` (opened from Today or a past session): the header (eyebrow "Tap the absent · 09:00–10:00 · LH-2"), Roll | Code tabs, counts, the roster grid of tiles (everyone present; tap toggles absent), a sticky save bar → `PUT` → toast "Attendance saved · students updated" → back to Today.
- Editing a saved session shows the previous absentees preselected and saves as a correction.
- Hide the bottom nav while attending (`body.attending`).

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] Tap 3 absent + save → the student's % changes (the SPEC §15 demo step 5).

## Notes
- From TE-01a (S08): Today navigates to **`/t/attend/:sessionId`** after `POST /attendance-sessions`. Add that line to `web/src/routes/teacher/routes.ts` (FS-09 rule).
- Done. Route `attend/:sessionId` added. The API has **no GET /attendance-sessions/:id**, so the page reads the session POST returned. `openAttendance` (queries.ts) now stashes it in `openedSessions`; a reload with no stash redirects to `/t`. Fix later: add the GET, then drop the stash.
- Code tab is a disabled placeholder (TE-03). No "Same device"/waiting states; `flaggedIds` ignored until TE-03.
- Eyebrow shows time and room only when the slot is in `/me/today` and the session is unsaved; otherwise "Past session · date" or "Correction · date". Roster has no avatarSeed (not in RosterEntry), so Avatar seeds by name.
- Verified live on c2/sub6: 3 absent saved, Aditya went 92% to 85%; correction (unmark him) restored 92%. That test session is left in the dev DB.
- S10 orchestrator: live curl verified (s31 92% → 85% after 3 absent; correction restores). Reload limit tracked as CS-14.
