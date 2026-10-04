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
