# FS-06 · Login, forgot/reset password
**Reads:** ARCH §9.1 · PROTO `index.html:144-151` (the password form style)
**Owns:** `web/src/routes/auth/*`

## Do
- `/login`: email + password, a "Forgot password?" link, errors inline in `.err`. On success → the role home (ARCH §10).
- `/forgot` (always "If that email exists, we sent a link"), `/reset/:token` (8+ characters, confirm match; the same validation as PROTO).
- A centred single card on the neutral landing palette with the brand mark.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] Logging in as each seed role lands on the right area; reset works through Mailpit.

## Notes
