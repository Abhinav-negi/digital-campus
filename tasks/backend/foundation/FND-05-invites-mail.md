# FND-05 · Invites + email
**Reads:** ARCH §9.1, §2 D3–D4 · SPEC §6 rules (14-day expiry, one account per email)
**Owns:** `server/src/lib/mail.ts`, `server/src/modules/invites/*`, the invite accept route in `modules/auth`

## Goal
The single-use invite token flow that both teacher (from the admin) and student (from a teacher) onboarding use.

## Do
- `lib/mail.ts`: nodemailer transport from config; `SMTP_HOST` empty → `{ jsonTransport: true }` and `console.log` the to/subject/text (so the invite link shows in the server log, D14); `sendMail(to, subject, text, html)`. Plain, friendly templates in the PROTO copy voice ("Your class CSE · 2nd year · A is on Digital Campus").
- `createInvite({email, role, classId?, invitedById})`: random token, store the hash, 14-day expiry, send the link `APP_URL/invite/<token>`. Re-inviting an existing pending email refreshes the token (that is the resend).
- `GET /auth/invite/:token` → `{email, studentIdNo?, className?, invitedBy}` (for the read-only fields); expired → 410.
- `POST /auth/invite/:token/accept {password, name?}` → activate the user, consume the invite, log in (cookie or token).
- **Only callable internally** by CS-02 (student invites) and AD-01 (staff invites); there's no public route to create one.

## Done when
- [ ] Creating an invite → the email (with link) is printed in the server log → accepting it logs you in.
- [ ] Reusing or using an expired token → 410.

## Notes
