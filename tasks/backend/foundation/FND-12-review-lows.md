# FND-12 · Review low-severity items (R6, R7, R9, R11–R13)
**Reads:** docs/REVIEW.md R6, R7, R9, R11, R12, R13
**Owns:** the specific handlers/files cited in those items; `web/src/routes/student/commons/people/People.tsx`, `web/src/routes/student/commons/build/Flagship.tsx` (URL scheme guard)

## Do
- R6: batch the seen/total counts on `/posts/mine` and `/classes/:id/posts` (one groupBy).
- R7: cap People search and the other unbounded Commons reads (take + cursor).
- R12: http(s) guard on user URLs in People and Flagship (reuse the S10 repoUrl helper).
- R13: `hiddenDetail` visible to author only, as the route summary says (or fix the summary if admin access is intended — ask).
- R9/R11: document as accepted in ARCH (device flag is a hint; class teachers may learn whether an email exists), no code.

## Done when
- [ ] Each item fixed or recorded as accepted; server + web checks green.

## Notes
