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
- [ ] `npx prisma migrate dev --name init` applies cleanly on a fresh DB.
- [ ] Every table in ARCH §7 exists (checked by listing models vs ARCH).

## Notes
