# CS-06 · Import via any chatbot (prompt → JSON → preview → apply)
**Reads:** ARCH §2 D8, §9.4 · CS-03 (subjects + allotment), CS-04 (`PUT timetable`), CS-07 (board items)
**Owns:** `server/src/modules/classes/imports/{routes,prompts,schemas,match}.ts`, `server/test/imports.test.ts`, plus removing the Claude bits: `server/src/config.ts` (`ANTHROPIC_API_KEY`, `IMPORT_MODEL`), `.env.example` (same lines), `server/package.json` (`@anthropic-ai/sdk`)
**Orchestrator does:** the migration dropping `DocumentImport` (schema is orchestrator-only) and `npm uninstall @anthropic-ai/sdk -w server`.

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
