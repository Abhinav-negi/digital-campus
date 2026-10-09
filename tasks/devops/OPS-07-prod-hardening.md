# OPS-07 · Production cookie + headers (review R5, R10)
**Reads:** docs/REVIEW.md R5, R10
**Owns:** server env parsing, `server/src/app.ts` (headers middleware), file-serving route, `docs/DEPLOY-CHECKLIST.md`

## Do
- `COOKIE_SECURE` defaults to true when NODE_ENV=production (fail boot if APP_URL isn't https in prod).
- Security headers without a new dependency: CSP, `frame-ancestors 'none'`, nosniff, referrer-policy. Uploaded files: `Content-Disposition: attachment` except images/PDF, plus nosniff.

## Done when
- [ ] Prod-mode boot test asserts Secure cookie + headers; dev unchanged.

## Notes
