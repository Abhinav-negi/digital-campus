# AF-05 · School setup + Audit log
**Reads:** ARCH §2 D2 · PROTO `admin.html:97-98` (audit list style) · API AD-04, AD-08
**Owns:** `web/src/routes/admin/{School,Audit}.tsx`

## Do
- School: institution name + timezone; branches table (add, rename, delete if unused).
- Audit: filters (actor, class, action, date range), list "**action** · detail / actor · date", cursor paging.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] Adding a branch makes it appear in the new-class wizard.

## Notes
