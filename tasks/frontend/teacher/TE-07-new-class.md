# TE-07 · New class wizard
**Reads:** SPEC §6 (Teacher) · ARCH §9.1 · PROTO `teacher.html:396-425`, `:517-538`
**Owns:** `web/src/routes/teacher/classes/NewClass.tsx`

## Do
- Step 1: branch (`GET /branches`), admission year (the default makes it 1st year this year; shows the computed "2nd year · Semester 3"), section, minimum % → the live class name.
- Step 2: paste ID + email (sample button only in dev) → the dry-run preview.
- Step 3: pick the CR → "Create & send invites" → `/t/class/:id/students`.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] Invite emails appear in the server log; the class shows in Classes with the CR set.

## Notes
- Built `NewClass.tsx` (3 steps), hooks appended to `teacher/queries.ts`, route line lazy-loaded, `NewClass.test.ts` (year label + local preview).
- Flow: POST /classes -> POST /classes/:id/invites (dryRun false) -> GET members -> PUT /classes/:id/cr -> `/t/classes/:id/students`.
- Dry-run endpoint needs an existing own class (classAccess 'own'), so step 2 uses the server preview via any class the teacher already owns, else a local parse (bad email + repeats only; no clash with existing accounts).
- BLOCKER: PUT /classes/:id/cr rejects non-active users (422) and invitees are `invited` until they accept, so the CR cannot be set at creation. UI toasts the error and still navigates. Needs a server change (allow invited CR, or apply it on invite accept).
- Verified with curl on :4104: class create, invites (emails in server log), members; CR PUT gave 422. Re-seeded, server stopped.
- Orchestrator (S09): CR-at-create was blocked (invited students → 422). User chose D17: invited students may be CR; fixed in members.ts + members.test.ts. Typecheck 0, server 165/165, web 10/10.
