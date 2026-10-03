# AF-05 · School setup + Audit log
**Reads:** ARCH §2 D2 · PROTO `admin.html:97-98` (audit list style) · API AD-04, AD-08
**Owns:** `web/src/routes/admin/{School,Audit}.tsx`

## Do
- School: institution name + timezone; branches table (add, rename, delete if unused).
- Audit: filters (actor, class, action, date range), list "**action** · detail / actor · date", cursor paging.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] Adding a branch makes it appear in the new-class wizard.

## Notes
