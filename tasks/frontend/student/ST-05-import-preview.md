# ST-05 · Import via any chatbot → preview → confirm (CR)
**Reads:** ARCH §2 D8, §9.4 · PROTO `teacher.html:162-167` (preview table + issue badges, the visual model) · API CS-06
**Owns:** `web/src/routes/student/class/edit/Import.tsx`

## Do
- Step 1: pick a kind (Timetable / Syllabus / Exam datesheet).
- Step 2: the prompt from `GET …/imports/prompts` in a read-only box with **Copy prompt**, and one line: "Paste this into ChatGPT, Gemini or Claude with your PDF or photo, then paste its reply below."
- Step 3: a textarea for the reply (or pick a `.json` file; read it in the browser) → `POST …/imports/preview`. A 422 shows the API's readable errors under the textarea.
- Step 4: an **editable preview table** per kind; rows with issues get warn/danger badges (unmatched teacher → an inline staff picker). Summary line "12 ready · 2 need a teacher". Confirm → `apply` → toast "Timetable added · 4 teachers notified".
- Always an "Enter it by hand" link.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] Pasting a sample timetable JSON ends with the slots visible on Board and Today.

## Notes
