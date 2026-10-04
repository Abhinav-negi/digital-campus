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
