# CM-10 · Student ID on my own profile
**Reads:** FS-10 Notes · docs/PARITY.md item 6 · API CM-01 (`PersonProfile`)
**Owns:** the profile builder + schema in `server/src/modules/commons/` (profiles), its test; `web/src/api/schema.d.ts` (gen); the header line in `web/src/routes/student/me/MePage.tsx`

## Do
- `PersonProfile.studentIdNo` only when the viewer is that person (`self`); absent for everyone else (privacy). Me header shows it ("25CSEA001").

## Done when
- [ ] Test: self sees `studentIdNo`, another student doesn't. Me shows it. Checks green.

## Notes
