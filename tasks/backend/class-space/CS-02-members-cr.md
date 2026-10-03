# CS-02 · Roster, student invites, CR
**Reads:** ARCH §3, §9.1 · SPEC §6 · PROTO `teacher.html:150-176` (paste parser + preview), `:362-372` (roster)
**Owns:** `server/src/modules/classes/members.ts`, `server/test/members.test.ts`

## Endpoints
- `GET /classes/:id/members` (read): students see `{id,name,isCR}` only; staff and admin also get `studentIdNo, email, status`.
- `POST /classes/:id/invites {rows:[{studentIdNo,email}], dryRun}` (own): parse like PROTO `parseList` (header row skipped, duplicates within the paste and against the DB, bad email). `dryRun:true` → the preview `{rows:[{…, issue:null|'Duplicate'|'Bad email'}], ready, dup, bad}`; `false` → creates invited Users (`homeClassId` = this class), ClassMembers and Profiles, and sends invites via FND-05. Audited.
- `POST /classes/:id/invites/resend {userId}` (own).
- `PUT /classes/:id/cr {userIds:[…]}` (own): 1–2 CRs, active students only; notify the old and new CRs ("You are now the CR of …"). Audited.
- `DELETE /classes/:id/members/:userId` (own): the student keeps the account and Commons profile and loses class access.

## Done when
- [ ] Tests: the dry-run preview counts match the PROTO SAMPLE list (`teacher.html:151`); a non-owner → 403; the CR change notifies; a removed student → 403 on the class.

## Notes
