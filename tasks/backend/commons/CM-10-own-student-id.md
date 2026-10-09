# CM-10 · Student ID on my own profile
**Reads:** FS-10 Notes · docs/PARITY.md item 6 · API CM-01 (`PersonProfile`)
**Owns:** the profile builder + schema in `server/src/modules/commons/` (profiles), its test; `web/src/api/schema.d.ts` (gen); the header line in `web/src/routes/student/me/MePage.tsx`

## Do
- `PersonProfile.studentIdNo` only when the viewer is that person (`self`); absent for everyone else (privacy). Me header shows it ("25CSEA001").

## Done when
- [ ] Test: self sees `studentIdNo`, another student doesn't. Me shows it. Checks green.

## Notes
- `profileView` (profiles.ts) selects `User.studentIdNo` and spreads `studentIdNo` only when `self && value`; schema field is `.optional()` so it is absent (not null) for others.
- Test in profiles.test.ts: Riya on s1 sees the DB value; on s12 (another student) the key is not in the body.
- MePage header: `{label} · {studentIdNo}` on the muted line. `npm run gen:api` regenerated schema.d.ts.
- Checks: typecheck, `npm test` (178 server + 14 web pass), `npm run build -w web` green. A first `npm test` run showed many file failures, probably shared test DB contention with the concurrent agent; the rerun was clean.
