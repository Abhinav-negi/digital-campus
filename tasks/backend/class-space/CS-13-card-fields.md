# CS-13 · Missing fields the frontend asked for (added S08)
**Reads:** PROTO `teacher.html:296-314` · `student.html:147-177` · existing `server/src/modules/classes/*`, `me/today.ts`
**Owns:** the `ClassCard` schema + query in the classes module, the schedule-change author shape in `me/today.ts`, their tests

## Do
- `GET /classes` (`ClassCard`) for staff: `mySubjects: string[]` (subjects I teach in that class), `invited: number` (pending student invites), `myAttendancePct: number | null` (average over my subjects' sessions).
- `/me/today` cancelled/moved changes: add `author.isCr: boolean` so ST-01 can drop its "(CR)" guess.
- `npm run gen:api`; then fill the three "–"/omitted spots in `web/src/routes/teacher/classes/ClassesList.tsx` (its `ponytail:` comment) and the CR tag in `web/src/routes/student/Today.tsx`.

- `/me/today` `clashWith[]` entries gain `teacher: { id, name } | null` (TE-01b banner reads "by {teacher}"; add it there once this lands).

## Done when
- [ ] Tests: seed teacher t2's class card shows their subjects, invited count and an attendance %; a CR-made cancellation has `isCr: true`; the seed clash's `clashWith[0].teacher` names the other teacher.

## Notes
