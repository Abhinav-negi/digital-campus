# FND-02 · Full Prisma schema + first migration
**Reads:** ARCH §7 (all), §3 · SPEC §13.2 (for field intent only)
**Owns:** `server/prisma/schema.prisma`, `server/prisma/migrations/*`, `server/src/lib/db.ts`

## Goal
**The whole data model in one go.** After this task the schema is frozen; later tasks request changes from the orchestrator.

## Do
- Translate ARCH §7 into Prisma: enums for every `[a|b]` list, relations with `onDelete` chosen deliberately (cascade for children like Answer/Message; restrict for Users referenced by history; `SetNull` for optional authors).
- Constraints that enforce rules in the DB: `User.email @unique`; `@@unique([sessionId, studentId])` on Attendance; `@@unique([postId, userId])` on PostSeen/Interest/SubmissionLike; `@@unique([userId, blockedId])`; at most one active Term per class (a partial unique index via raw SQL in the migration: `WHERE "endedAt" IS NULL`).
- Indexes for hot reads: `ScheduleChange(classId, date)`, `TimetableSlot(termId, weekday)`, `Attendance(studentId)`, `BoardPost(kind, createdAt)`, `Notification(userId, readAt)`, `AuditLog(classId, createdAt)`.
- `lib/db.ts` exports one `PrismaClient`.

## Done when
- [x] `npx prisma migrate dev --name init` applies cleanly on a fresh DB.
- [x] Every table in ARCH §7 exists (checked by listing models vs ARCH).

## Notes
- 🟨 S04: Prisma 6.19.3, 41/41 ARCH §7 models, migration `20261003102946_init` built offline with `migrate diff` (validate/generate/typecheck/tests green). ✅ S04: `migrate deploy` on fresh `campus` + `campus_test` (embedded PG 17.10): 41 tables, partial index present, `migrate diff --exit-code` vs schema = no difference. **Schema frozen.**
- Partial index `Term_one_active_per_class` is hand-written at the end of migration.sql; if a later `migrate dev` emits `DROP INDEX` for it, delete that line.
- `server` scripts: `npm run prisma -- <cmd>` loads root `.env.example`/`.env` (Prisma 6 only looks in `server/`); `prebuild/pretypecheck/pretest` run `prisma generate` (install scripts don't run here).
- Commons/Post rows have no `institutionId` (as ARCH §7); derive it from the author. `BoardItem.units` is a required `String[]` (empty = none). `Challenge.winnerIds`, `Report.targetId` have no FK.
- Tests (FND-08) must point Prisma at `TEST_DATABASE_URL` (`datasourceUrl` or env in the test script).
