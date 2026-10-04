# AF-04b · Commons: conversations + featured
**Reads:** ARCH §2 D2 · API AD-06 (conversations), AD-07
**Owns:** `web/src/routes/admin/commons/{Conversations,Featured}.tsx`

## Do
- Conversations: search by user → list → read the thread (a banner "Reading is logged").
- Featured: the PROTO star list (3 max) + "Set as flagship".
- Mount both as tabs of AF-04a's CommonsAdmin (one import + one line each).

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] Reading a thread writes an audit row; the flagship shows on the student Build page.

## Notes
