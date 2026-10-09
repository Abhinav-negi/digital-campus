# TE-06 · Class settings: minimum %, next semester, graduate, hand over
**Reads:** ARCH §2 D5, §9.2 · PROTO `teacher.html:387-394` · API CS-01
**Owns:** `web/src/routes/teacher/class/SettingsTab.tsx`

## Do
- Minimum attendance (1–100). Hand over (a staff picker instead of a free email, since teachers already exist).
- **Start next semester**: a confirm sheet explaining what happens ("Semester 3 → 4. Subjects, timetable and attendance of Semester 3 are kept read-only. The roster carries over. Your CR will add the new timetable.") → POST → toast.
- **Graduate class** (shown after semester 8, or always for admin) with a strong confirm.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] Promotion updates the class name/year across the app; the old term is visible read-only.

## Notes
- Built `SettingsTab.tsx` (props `c`=ClassCard, `isAdmin`); hooks `useClassSettings`/`useStaffSearch` appended to teacher/queries.ts; ClassView renders it. Server caps min % at 1-99 (not 100): input uses max 99.
- Graduate: shown instead of Next when semester >= 8; admin also gets it always (separate card). Confirm sheets for next/graduate; hand-over uses `window.confirm` like StudentsTab. Staff picker duplicated inline (the Subjects one is embedded in SubjectSheet, not extractable additively). After hand-over the old teacher loses the Settings tab (myRole changes).
- Live (port 3141, throwaway ECE 2031/TE06 and 2032/TE06B, no delete endpoint so they remain): PATCH min 80; next x2 -> "ECE · 2nd year" / Semester 3 in GET and list; old term board readable with ?termId, PATCH/DELETE on old item -> 409 PAST_TERM; handover t1->t2 ok, t1 then 403.
- Checks: typecheck, web tests, build pass.
