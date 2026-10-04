# CS-06 · Import via any chatbot (prompt → JSON → preview → apply)
**Reads:** ARCH §2 D8, §9.4 · CS-03 (subjects + allotment), CS-04 (`PUT timetable`), CS-07 (board items)
**Owns:** `server/src/modules/classes/imports/{routes,prompts,schemas,match}.ts`, `server/test/imports.test.ts`
**Orchestrator did (S07):** dropped `DocumentImport` (migration), uninstalled `@anthropic-ai/sdk`, removed the config/env lines.

## Idea
No AI in the server. The CR copies our prompt, gives it + their PDF/photo to any chatbot (ChatGPT, Gemini, Claude), and pastes back the JSON. The server only validates it. Stateless: nothing is stored until apply.

## Endpoints (board permission: CR, class teacher, admin)
- `GET /classes/:id/imports/prompts` → `{timetable, syllabus, datesheet}` prompt texts. Each prompt: what to extract, "reply with only JSON", the exact shape, one short example, times as HH:MM 24h, weekday names.
- `POST /classes/:id/imports/preview {kind, data}` → `{draft, summary}`. Zod-validate `data` (422 with readable paths on bad JSON); normalise times to HH:MM and weekday names/abbreviations to 1–6; match `teacherName` to staff (lowercase, strip Dr./Prof./Mr./Ms., token overlap, best ≥0.6 else `unmatched-teacher`). Rows carry `issue`: `unmatched-teacher`, `bad-time`, `unknown-subject`.
- `POST /classes/:id/imports/apply {kind, draft}`: re-validate, one transaction. Timetable → upsert subjects (matched teachers → CS-03 allotment notifications) + replace slots like `PUT timetable`. Syllabus → BoardItem(kind syllabus, `units[]`). Datesheet → BoardItem(kind exam) rows. Audited. Reuse the CS-03/04/07 service code; don't copy it.

## Shapes (`schemas.ts`)
timetable `{subjects:[{name,code?,teacherName?}], slots:[{subject,weekday,start,end,room?}]}` · syllabus `{subjects:[{name,units:[string]}]}` · datesheet `{exams:[{subject,title,date,note?}]}`. Accept the JSON wrapped in a ```json fence (chatbots add it).

## Done when
- [ ] Tests: bad JSON → 422; a fenced/sloppy-time draft normalises; teacher matching works; apply writes subjects + slots + notifications atomically; a student → 403.
- [ ] `grep -rn "anthropic\|ANTHROPIC\|IMPORT_MODEL" server .env.example` → nothing.
- [ ] Manual: paste one real ChatGPT/Gemini output for a timetable photo → a sensible draft.

## Notes
- Was "Claude API import" until S06; switched so the project needs no API key or cost.
- Reuse: `allot` (subjects.ts), `create` (board.ts, now exported), and new exported `replaceWeek` (timetable.ts, extracted from `PUT /timetable`, which now calls it). Apply = subjects upsert by name (case-insens, existing teacher kept if draft has none) + allot + replaceWeek + one `import.timetable` audit.
- Draft rows carry `teacherId`/`subjectId` so the CR can edit; apply re-normalises and recomputes issues, never trusting `issue`. `data` may be raw pasted text (fence/chatter stripped) or an object. Added a 4th issue `bad-date` (datesheet). Unmatched-teacher and unmatched-exam-subject are allowed through apply; bad time/date/unknown subject (timetable, syllabus) → 422.
- Teacher/subject match = Dice token overlap after stripping titles, best >= 0.6 ("Mathew" -> Prof. David Mathew; "A. Rao" does not match).
- Manual item met via realistic fixture (sloppy fenced reply in imports.test.ts); real chatbot paste NOT CHECKED.
- Gotcha: run test files with --test-concurrency=1 (shared campus_test DB); imports.test + timetable.test in one parallel run clash.
