# FS-07 · Invite → set password → three questions
**Reads:** SPEC §6 (Student) · ARCH §9.1 · PROTO `index.html:123-201` (the whole flow), `:34-41` (dots, choices)
**Owns:** `web/src/routes/onboarding/*`

## Do
- `/invite/:token`: the email preview card → set password (ID and email read-only) → for students, the 3 questions (availability Yes/Maybe later/Not now → open/questions/focus+14d; up to 5 skills from the PROTO list or typed; GitHub/LeetCode/LinkedIn) → "You're in." → `/s`. Staff skip the questions → `/t`.
- Expired token → a friendly page: "This invite has expired. Ask your teacher to resend it."
- Step dots exactly as PROTO.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] A seed invited student completes it and lands on Today, with the profile saved.

## Notes
- S05: depends on CM-01 too (`PATCH /me/profile` saves the 3 answers). Also: bounce logged-in users off /login, and make shell logout invalidate `['me']` (FS-06 Notes).
- Done S05. E2E in headless Chrome: invited student s29 → password → 3 questions → "You're in." → /s, profile saved (focus +14d, skills, link handles); staff t8 → /t; a reused link → the expired page. Dev DB re-seeded afterwards.
- `handleOf()` turns pasted GitHub/LinkedIn/LeetCode URLs or `@handle` into the bare handle (the server accepts handles only). `/login` loader bounces logged-in users; shell logout already did `qc.clear()`.
- Differences from PROTO: AuthCard frame; the mail line has no name (the invite GET doesn't return it); an extra typed-skill input (spec asks for it); the button says "Go to Today".
- Follow-ups: return the invitee `name` + label from `GET /auth/invite/:token`; staff also see "Ask your teacher to resend it" on the expired page (the role is unknown on a 410).
