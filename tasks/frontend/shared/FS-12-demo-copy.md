# FS-12 · Demo copy and label nits
**Reads:** docs/DEMO.md "Minor polish"
**Owns:** `web/src/routes/student/class/edit/TipSheet.tsx` (copy only), `web/src/routes/student/Today.tsx` ("Up next" change label), the staff picker filter in `web/src/routes/student/class/edit/Import.tsx`

## Do
- "Import from a PDF or photo" → "Import with any chatbot (copy a prompt, paste its reply)" (D8).
- Today "Up next": an extra class is labelled "extra", not "moved".
- Import staff picker: hide the chief/office account (no teaching dept), as the Subjects picker does.

## Done when
- [x] The three texts/labels are right in a screenshot. Web checks green.

## Notes
- TipSheet button now reads "Import with any chatbot (copy a prompt, paste its reply)". Today "Up next" shows " · extra" for change.kind 'extra', " · moved" otherwise.
- Import TeacherPick: `GET /staff` already returns `dept` (null for Office of Academics), so it fetches 8 and filters `t.dept` client-side, then shows 5. Note Subjects.tsx does not actually filter (it only prints the dept); left alone, not in scope.
- Verified: created a temporary extra class via API, headless screenshot shots/fs12-today.png showed "06:40-07:30 · X-1 · Dr. Meera Iyer · extra"; change deleted afterwards (204).
- Not visually checked: the TipSheet (CR board is not empty in the dev DB, so the sheet does not open) and the Import staff chips (need an unmatched-teacher preview); both are one-line changes verified in code and the /staff payload.
- typecheck, `npm test -w web`, `npm run build -w web` green.
