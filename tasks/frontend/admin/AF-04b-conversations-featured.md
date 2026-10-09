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
- Conversations.tsx: search (q) + list + read-only Sheet thread; `useConversationMessages` has gcTime 0 so each open re-reads and re-audits. First 100 messages only.
- Featured.tsx: star (PUT /admin/featured/{type}/{id}) + "Set as flagship" (PUT /admin/flagship); the flagship row shows a badge and no star (API 409s on it).
- Live: opened cv1 -> conversation.read audit row at open time; flagship pr2 -> GET /commons/projects flagship=pr2; star at 3/3 -> 409 FEATURED_FULL. Restored flagship pr0 (featured pr0, pr1, pr3 unchanged). Seed cv1 has zero messages.
- Checks: typecheck, web tests, web build all pass.
