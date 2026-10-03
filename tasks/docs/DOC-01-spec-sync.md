# DOC-01 · Sync the product spec with the decisions
**Reads:** ARCH §2 (D1–D13), §3, §9 · SPEC §4, §6, §7, §12, §13, §18
**Owns:** `../Digital_Campus.md`

## Goal
SPEC still describes the old weak admin and teacher self-sign-up. Make it agree with ARCH so "this file wins" is true again.

## Do
- §4 Roles + the wall table: the admin as chief (D1, D2), the admin inbox (D6), the CR's subject/teacher powers (D7).
- §6 Onboarding: the admin invites teachers (D3); the student is locked to a batch (D4).
- §7.1: subjects pick a teacher from the staff directory + auto-allotment + "Not me" (D7); PDF/photo import (D8); empty states (D9); week-ahead changes, events, clashes (D10, D11).
- §7.4: teacher Cancel / Postpone on Today. §7.5: batch promotion via "Start next semester", Graduate (D5).
- §10 Admin screens: Inbox · People · Classes · Commons · School · Audit.
- §12 Privacy: admins can read Commons conversations, and students are told (D2).
- §13: replace the stack/model/API sketch with a pointer to `digital-campus/ARCHITECTURE.md`.
- §18: answer Q1 (admin invites only) and Q5 (admin moderates and features, and doesn't post).

## Done when
- [ ] No sentence in SPEC contradicts ARCH §2.
- [ ] The Guide row stays removed (done in S01).

## Notes
- S02: ~190 changed lines across SPEC §4–§19. The spec is outside git, so the pre-edit copy is `../Digital_Campus.md.bak-S02`.
- The orchestrator corrected the agent on two points, following CS-01/CS-02/TE-05/TE-06. A class teacher **can remove** students and **can hand over** the class, and the admin can do both too. Only *moving* a student between batches is admin-only (D4).
- Left as is: a student can still be a member of a second class (`ClassMember`) while `homeClassId` stays fixed. Phases in SPEC §14 are build order, not scope.
