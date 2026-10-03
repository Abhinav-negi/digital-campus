# TE-07 · New class wizard
**Reads:** SPEC §6 (Teacher) · ARCH §9.1 · PROTO `teacher.html:396-425`, `:517-538`
**Owns:** `web/src/routes/teacher/classes/NewClass.tsx`

## Do
- Step 1: branch (`GET /branches`), admission year (the default makes it 1st year this year; shows the computed "2nd year · Semester 3"), section, minimum % → the live class name.
- Step 2: paste ID + email (sample button only in dev) → the dry-run preview.
- Step 3: pick the CR → "Create & send invites" → `/t/class/:id/students`.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] Invite emails appear in the server log; the class shows in Classes with the CR set.

## Notes
