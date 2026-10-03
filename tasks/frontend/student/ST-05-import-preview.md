# ST-05 · Import from PDF/photo → preview → confirm (CR)
**Reads:** ARCH §2 D8, §9.4 · PROTO `teacher.html:162-167` (preview table + issue badges, the visual model) · API CS-06
**Owns:** `web/src/routes/student/class/edit/Import.tsx`

## Do
- Hidden when `GET …/imports/enabled` is false.
- Pick a kind (Timetable / Syllabus / Exam datesheet) → a file input (PDF, JPG, PNG; the camera works on phones) → presign upload → POST → a "Reading your file…" state (poll 2s).
- Ready → an **editable preview table** per kind; rows with issues get warn/danger badges (unmatched teacher → an inline staff picker). The summary line is "12 ready · 2 need a teacher". Confirm → apply → toast "Timetable added · 4 teachers notified".
- Failed → the API message + "Enter it by hand" link.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] With the stubbed or real API, a timetable import ends with the slots visible on Board and Today.

## Notes
