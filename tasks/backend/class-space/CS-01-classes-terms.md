# CS-01 · Classes (batches) + terms + promotion
**Reads:** ARCH §2 D4–D5, §3, §9.1, §9.2 · SPEC §6, §7.5 · PROTO `teacher.html:396-425` (wizard fields), `:387-394` (settings)
**Owns:** `server/src/modules/classes/{routes,service}.ts` (class + term endpoints only), `server/test/classes.test.ts`

## Endpoints
- `GET /classes`: my classes (student: home + extra; staff: class teacher or allotted; admin: `?all=1`). Each class: name, branch, yearOfStudy, term label, counts, CR names, my role in it.
- `POST /classes {branchId, admissionYear, section?, minAttendancePct}` (staff) → creates the class + Term 1 (semester from `admissionYear` vs today, editable), the creator = class teacher.
- `GET /classes/:id` (read) · `PATCH /classes/:id {minAttendancePct, section}` (own).
- `GET /classes/:id/terms` (read): all terms, so past ones can be browsed read-only.
- `POST /classes/:id/terms/next` (own): D5 promotion, in a transaction, audited, notifies the class.
- `POST /classes/:id/graduate` (own, only after semester 8 or by admin) → `archivedAt`.
- `POST /classes/:id/handover {teacherId}` (own): the new class teacher must be staff; notify both.

## Rules
- Name = `${branch.code} · ${ord(yearOfStudy)} year${section ? ' · '+section : ''}`, recomputed on promotion.
- An archived class is read-only for everyone except the admin.

## Done when
- [ ] Tests: promotion carries members, closes the old term, increments the year label; past-term subjects aren't returned by active-term queries; graduate archives; a subject teacher → 403 on next/graduate/handover; admin → 200 + audit.

## Notes
- Done S05. Reuse from `classes/service.ts`: `writable` (after `classAccess` on every class write → 409 ARCHIVED for non-admins), `activeTerm(classId, tx?)` (or 409 NO_ACTIVE_TERM), `classAudience(classId, tx?)`, `className` / `yearOf` / `semesterFor` (academic year starts in July, `ponytail:`).
- Sub-routers: `Router({ mergeParams: true })`, then `router.use('/:id', sub)` above the trailing stub in classes/routes.ts.
- `GET /classes` → `{items, nextCursor}` of ClassCard (myRole, termLabel, counts, crs). `POST /classes` takes an optional `semester` (the "editable" part).
- Promotion deletes `ClassMember(role teacher)` rows (they came with old-term subjects; the CR re-allots in CS-03). From semester 8 → 409 GRADUATE_INSTEAD. Graduate closes the active term too; before semester 8 only the admin may graduate.
- Notification types `class-term`, `class-handover` (CS-12 may rename). Audit actions `class.create|update|term.next|graduate|handover`.
