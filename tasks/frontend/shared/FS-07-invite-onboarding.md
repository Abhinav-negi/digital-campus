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
