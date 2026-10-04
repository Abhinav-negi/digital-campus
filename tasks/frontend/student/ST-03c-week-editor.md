# ST-03c · CR edit: weekly timetable editor
**Reads:** ARCH §2 D11, §9.3 · API CS-04
**Owns:** `web/src/routes/student/class/edit/WeekEditor.tsx`

## Do
- A grid of slots per weekday; add/edit/delete slots (subject, start, end, room).
- Overlaps are allowed and shown with a Clash badge.
- Save → `PUT /classes/:id/timetable`.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] From an empty class: subjects (ST-03b) → timetable → an exam (ST-03a), and the slots show on Board and Today.

## Notes
