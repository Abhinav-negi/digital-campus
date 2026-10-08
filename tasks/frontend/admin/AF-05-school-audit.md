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
Done. School.tsx (institution form, branches add/rename/delete via FormSheet; delete disabled when classCount>0), Audit.tsx (useInfiniteQuery, Load more). Actor/class filter options come from rows loaded so far. Live-verified add→wizard list→rename→delete (DB clean), audit filter + cursor.
- S11 orchestrator: live curl verified (branch add → wizard /branches lists it → rename → delete; audit filter + cursor). Actor/class filters only list values from loaded rows (ponytail-marked).
