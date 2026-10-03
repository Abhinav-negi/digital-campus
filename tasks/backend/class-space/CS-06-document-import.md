# CS-06 · Document import (Claude API)
**Reads:** ARCH §2 D8, §5 (import row), §9.4 · **Load the `claude-api` skill before writing code.**
**Owns:** `server/src/modules/classes/imports/{routes,extract,schemas}.ts`, `server/test/imports.test.ts`

## Endpoints
- `GET /classes/:id/imports/enabled` → `{enabled: !!ANTHROPIC_API_KEY}`.
- `POST /classes/:id/imports {kind: timetable|syllabus|datesheet, fileKey}` (board) → `{id, status:'processing'}`; extraction runs in the background (an in-process promise; `ponytail:` move to a queue if needed).
- `GET /classes/:id/imports/:importId` → status + the draft (rows carry `issue` flags: `unmatched-teacher`, `bad-time`, `unknown-subject`).
- `PATCH …/:importId {draft}`: save the CR's edits (re-validated).
- `POST …/:importId/apply`: one transaction. Timetable → upsert subjects (with matched teachers → CS-03 allotment notifications) + `PUT timetable`. Syllabus → BoardItem(kind syllabus, `units[]`, `fileKey` = the original). Datesheet → BoardItem(kind exam) rows. Audited; status `applied`.

## Extraction
- Send the file (PDF document block, or image block) with a kind-specific instruction + **structured output matching zod schemas in `schemas.ts`** (timetable: `{subjects:[{name,code?,teacherName?}], slots:[{subject,weekday,start,end,room?}]}`; syllabus: `{subjects:[{name,units:[string]}]}`; datesheet: `{exams:[{subject,title,date,note?}]}`).
- Normalise times to HH:MM 24h and weekday names to 1–6. Match `teacherName` to staff (lowercase, strip Dr./Prof., token overlap; the best match ≥0.6 confidence, else `unmatched-teacher`).
- On API error or invalid output → `failed` + a human message ("Couldn't read this file, try a clearer photo or enter it by hand").

## Done when
- [ ] Tests with the Anthropic client **stubbed** (inject a fake extractor): a draft is validated, teacher matching works, and apply writes slots + subjects + notifications atomically; a student → 403.
- [ ] Manual (with a key): a real timetable PDF and a phone photo produce a sensible draft.

## Notes
