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
- `edit/Subjects.tsx` (list + add/edit sheet + remove) is shown in ClassPage only when the CR is editing the latest term (past-term edits 409).
- No PROTO markup exists for a subjects manager (student.html has none), so it reuses `.section`, `.card.row`, `.icon-btn`, `.chip` from existing styles.
- Teacher picker = search box -> `GET /staff?q=&limit=8` chips; no debounce (ponytail: add if /staff gets chatty). A teacher is required on save (API needs teacherId); "No teacher yet" shows when `teacher` is null (declined/removed).
- Remove surfaces the server's 409 HAS_ATTENDANCE message as a toast; there is no confirm dialog.
- Not run against the live API; only typecheck + unit tests. TipSheet's 'timetable'/'syllabus' picks still just enter edit mode.
- S10 orchestrator: Done-when verified by curl as the c3 CR (POST subject with t1 → Meera's GET /classes gains c3); test subject deleted.
