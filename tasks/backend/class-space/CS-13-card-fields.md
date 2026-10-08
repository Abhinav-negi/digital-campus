# CS-13 · Missing fields the frontend asked for (added S08)
**Reads:** PROTO `teacher.html:296-314` · `student.html:147-177` · existing `server/src/modules/classes/*`, `me/today.ts`
**Owns:** the `ClassCard` schema + query in the classes module, the schedule-change author shape in `me/today.ts`, their tests

## Do
- `GET /classes` (`ClassCard`) for staff: `mySubjects: string[]` (subjects I teach in that class), `invited: number` (pending student invites), `myAttendancePct: number | null` (average over my subjects' sessions).
- `/me/today` cancelled/moved changes: add `author.isCr: boolean` so ST-01 can drop its "(CR)" guess.
- `npm run gen:api`; then fill the three "–"/omitted spots in `web/src/routes/teacher/classes/ClassesList.tsx` (its `ponytail:` comment) and the CR tag in `web/src/routes/student/Today.tsx`.

- `/me/today` `clashWith[]` entries gain `teacher: { id, name } | null` (TE-01b banner reads "by {teacher}"; add it there once this lands).

## Done when
- [x] Tests: seed teacher t2's class card shows their subjects, invited count and an attendance %; a CR-made cancellation has `isCr: true`; the seed clash's `clashWith[0].teacher` names the other teacher.

## Notes
- `ClassCard` gains `mySubjects`, `invited`, `myAttendancePct` via `withMine` in classes/service.ts (3 batched queries); students get `[]/0/null`. Attendance % = present/total records over my saved sessions in the class (not a per-session mean).
- `/me/today` items now use a `TodayItem` schema: `change.author.isCr` (CR of the item's own class) and `clashWith[].teacher`; done in `decorate()` in me/today.ts, so `/classes/:id/schedule` is unchanged.
- Web: ClassesList and ClashBanner filled in. Student CR tag still to add in student/Today.tsx: `item.change.author.isCr` (on `cancelled[]` entries).
- S10 orchestrator: server 167/167 re-run; student Today CR tag now reads change.author.isCr (done by orchestrator after ST-06 landed).
