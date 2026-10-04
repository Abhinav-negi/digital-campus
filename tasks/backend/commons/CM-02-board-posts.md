# CM-02 · Commons Board: posts, feed, caps, expiry
**Reads:** SPEC §9.2, §9.5 · PROTO `student.html:249-304` (kinds, card, feed, compose forms), `:284-303` (field config per kind)
**Owns:** `server/src/modules/commons/board.ts`, `server/test/board-posts.test.ts`
> All routes sit under `/commons` behind the `commons()` guard (FND-04): students + admins; teachers get 403.

## Endpoints
- `GET /commons/board-posts?kind=all|ask|gig|market|lf&branchId=&q=&cursor=`: live only (not hidden, `expiresAt ≥ today`), newest first, closed sorted after open on ties; each has the author byline (name, branch/year label, `otherBranch` flag vs me) and a count (answers / interested / claims).
- `POST /commons/board-posts {kind, …fields per kind}`: a zod discriminated union matching the PROTO forms (≤5 fields). Expiry: ask 14d, gig = deadline, market/lost/found 30d. **Cap: 5 new posts per student per day** → 429 "You have used your 5 posts for today".
- `GET /commons/board-posts/:id`: the detail with the actions allowed for me. The Found `hiddenDetail` is visible **only to the author** (and admin).
- `PATCH /commons/board-posts/:id/status {status}` (author): only valid transitions per kind (solved / done / sold / given / returned).
- `POST /commons/board-posts/:id/extend` (author): +14/30 days. `DELETE` (author).
- Smart routing: on a new ask or gig, notify (bundled, at most 1 per day per user) students whose skills match the tags, plus helps-juniors seniors.

## Done when
- [ ] Tests: the sixth post in a day → 429; expired posts are hidden from the feed; `hiddenDetail` never leaks to non-authors; an invalid status transition → 422.

## Notes
- Done S05. Feed ordering is in memory (institution day desc, then open before closed; `ponytail:`); the cursor is the last id. The 5/day cap counts by institution day, check-then-insert (a simultaneous double post can slip through; accepted).
- Expiry: ask/gig +14d, others +30d, from max(today, expiresAt); closed posts can't extend. Delete is hard (answers/interests/claims cascade; thanks keep their row with postId null).
- Made-up limits: gig deadline ≤ today+90d, price ≥ 1, title 140 / body 2000 / tag 40 ×10. No photos (PROTO forms have none).
- Smart routing → `board-match`: skill-tag match + helps-juniors seniors, Focus skipped, max 1 per user per institution day.
- Follow-ups: CM-06 implements the `message` action (market/lost); CM-07 adds block filtering; CS-12 adds the "still need this?" nudge. The seed writes `expiresAt` as a timestamp, not a date (reads still work).
