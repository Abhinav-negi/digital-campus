# ST-07a · Commons: header, feed, compose
**Reads:** SPEC §9.2 · PROTO `student.html:239-304` (rCommons, KIND, bpCard, cBoard, composeSheet/Form) · API CM-02
**Owns:** `web/src/routes/student/commons/{CommonsPage,Board,BoardCard,Compose}.tsx`

## Do
- The Commons header (tabs Board · Build · People, "+ Post", a FAB on mobile) + the **admin-visibility notice** (D2): "Admins can see Commons activity, including messages, for safety."
- The feed with search, branch select and kind chips; cards with kind colours; cursor "Show more".
- The "What do you need?" picker → the per-kind form (honesty and safety notes on Gig and Market).

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] Posting each kind works and shows in the feed; the 5/day cap shows its toast.

## Notes
- S08 ✅ Feed uses `useInfiniteQuery` + debounced search, branch and kind filters. A 429 shows "You have used your 5 posts for today". Not run end to end yet.
- `Board` takes an `onOpen(id)` prop that `CommonsPage` doesn't pass yet: ST-07b wires the post sheet there. Build/People tabs are `Empty` placeholders for ST-08a/ST-09.
- Orchestrator removed a hard-coded institution name from the subtitle. The `.k-*` card tints in student.css are still hex (QA-03).
