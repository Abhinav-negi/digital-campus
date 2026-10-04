# ST-03b · CR edit: subjects + teacher picker
**Reads:** ARCH §2 D7 · API CS-03
**Owns:** `web/src/routes/student/class/edit/Subjects.tsx`

## Do
- Subjects manager: list + add/edit (name, code, **teacher picker** searching `GET /staff`; shows "Arjun Rao will be notified").
- A removed or declined teacher shows "No teacher yet".

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] The CR adds a subject with a teacher → that teacher sees the class on their dashboard.

## Notes
