# AF-02 · People: teachers, students, admin badge
**Reads:** ARCH §2 D1–D4 · PROTO `admin.html:75-84` · API AD-01, AD-02, AD-03
**Owns:** `web/src/routes/admin/people/*`

## Do
- Search + role/branch/status filters, rows with avatar, name, role, admin/chief badges, status.
- **Add teacher** sheet (name, email, department) → invite sent.
- The user sheet: edit details (students: name, ID, email; Move to batch picker), Disable/Enable, Reset password, **Make admin / Remove admin** (disabled for the chief with a tooltip), Ban/Unban (Commons), Delete (strong confirm).

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] Add teacher → they accept the invite → they appear active; badge grant works.

## Notes
