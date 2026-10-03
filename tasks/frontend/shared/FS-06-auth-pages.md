# FS-06 · Login, forgot/reset password
**Reads:** ARCH §9.1 · PROTO `index.html:144-151` (the password form style)
**Owns:** `web/src/routes/auth/*`

## Do
- `/login`: email + password, a "Forgot password?" link, errors inline in `.err`. On success → the role home (ARCH §10).
- `/forgot` (always "If that email exists, we sent a link"), `/reset/:token` (8+ characters, confirm match; the same validation as PROTO).
- A centred single card on the neutral landing palette with the brand mark.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] Logging in as each seed role lands on the right area; reset works through the emailed link (server log).

## Notes
- Done S05. E2E in headless Chrome: Riya → /s, Meera → /t, chief (0 classes after the FND-03 fix) → /a; wrong password → inline `.err`; reset via the logged link works, reuse → 410 copy with /forgot link. Parity at 1280/390 vs PROTO index.html invite card (neutral palette: near-black button, brand mark above the card).
- **Deviation:** reset doesn't log in (`/auth/reset` is 204 and ends all sessions), so it clears `['me']`, toasts, and goes to /login.
- Reuse in FS-07: `AuthCard` (routes/auth/card.tsx), `checkPassword` (reset.tsx), the 410 pattern, `fetchQuery({...meQuery, staleTime: 0})` before `navigate(homeOf(me))`.
- Orchestrator: `import.meta.env?.DEV` in router.tsx so node tests can import it. **Open:** /login doesn't bounce logged-in users; shell logout must invalidate `['me']` (FS-07 picks both up).
