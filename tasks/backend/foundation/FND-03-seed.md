# FND-03 · Seed: the prototype's demo world
**Reads:** ARCH §7, §12 · PROTO `data.js:33-265` (port `build()` 1:1)
**Owns:** `server/prisma/seed.ts`, root script `db:reset`

## Goal
`npm run db:reset` produces the same world the prototype shows, so every screen can be compared side by side and the SPEC §15 demo works.

## Do
- The institution, the 5 branches, 20 classes (c1 CSE·2·A, c2 CSE·2·B, c3 ECE·1 detailed + 17 thin), **an active Term per class** (semester from year: `y*2-1`).
- The teachers: Meera Iyer (class teacher c1), Arjun Rao, Sana Khan, David Mathew; **the chief admin "Office of Academics" `academics@demo.edu` (`isAdmin`, `isChief`, role staff)**; two invited-not-accepted teachers (as pending invites, replacing PROTO `pendingTeachers`).
- The students with the same deterministic names, IDs and emails (keep the PROTO PRNG `seed=11` and formulas), `homeClassId`, `studentIdNo`, CRs (Riya Patel = CR of c1), and the last 2 per class `invited`.
- Subjects + teachers, timetable (`tt` array), today's cancelled slot → a `ScheduleChange`, attendance history (12 sessions/subject with the same probabilities), board items, posts + seen, reminders, profiles, projects (flagship pr0), board posts, answers, interests, thanks, join requests, updates, challenges, conversations, reports, audit, notifications.
- **Add** one same-day clash in c1 (an `extra` change overlapping an existing slot) so the clash UI has data, plus one ticket from a student.
- Password `campus123` for every active account (scrypt via `lib/auth` hash fn). `SEED_MODE=prod` seeds only the institution, branches and the chief.

## Done when
- [ ] `npm run db:reset` is idempotent and finishes in under 10s.
- [ ] Spot-check: Riya's DS attendance text matches the prototype for the same day.

## Notes
