# AF-02 · People: teachers, students, admin badge
**Reads:** ARCH §2 D1–D4 · PROTO `admin.html:75-84` · API AD-01, AD-02, AD-03
**Owns:** `web/src/routes/admin/people/*`

## Do
- Search + role/branch/status filters, rows with avatar, name, role, admin/chief badges, status.
- **Add teacher** sheet (name, email, department) → invite sent.
- The user sheet: edit details (students: name, ID, email; Move to batch picker), Disable/Enable, Reset password, **Make admin / Remove admin** (disabled for the chief with a tooltip), Ban/Unban (Commons), Delete (strong confirm).

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [x] Add teacher → they accept the invite → they appear active; badge grant works.

## Notes
- Route is `people` (index only) in routes.ts; page = people/index.tsx, sheet = people/UserSheet.tsx; hooks appended to admin/queries.ts (useUsers, useAllClasses, usePeopleMutations).
- AdminUser has no bannedAt, so student sheet shows both "Ban from Commons" (reason prompt) and "Unban" (idempotent) rather than a state-aware toggle.
- Move picker uses GET /classes?all=1 (limit 100, archived filtered out, current class excluded); no pagination beyond 100 classes.
- Chief: Disable, Remove admin, Delete are disabled with a title tooltip (server also 409s). Admin badge only shown for staff.
- Live check vs :3142: invite -> accept via mailed token -> active in /admin/users -> PUT admin true/false; chief revoke 409. Test user af02test@demo.edu was deleted (anonymised row remains).

