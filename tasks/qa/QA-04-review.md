# QA-04 · Code review + security review
**Reads:** ARCH §3, §5 (auth) · the whole diff
**Owns:** nothing (it reports findings; fixes become tasks)

## Do
- Run `/code-review high` (correctness) and `/security-review` over the repo. Focus on: the guard coverage, session handling, CSRF on cookie routes, presigned URL scope, the Found `hiddenDetail` leak, rate limits, and N+1 queries on Today/People.
- File each confirmed finding as a task row in INDEX.

## Done when
- [ ] Every confirmed finding is fixed or tracked.

## Notes
- D15: while there's one institution per deployment, unscoped admin lookups are fine. If multi-institution is enabled, every `/admin` and staff lookup must filter by the actor's `institutionId` (flagged by the security review on AD-01, S05).
- QA-04 result (docs/REVIEW.md): 0 high, 5 med, 8 low; no IDOR, session, CSRF, path-traversal or hiddenDetail leak found (CSRF/presign/logout reproduced live on :3000, test data removed).
- Med, need INDEX task rows (orchestrator files them): SEC-01 trust-proxy for rate-limit IPs (campus-wide login lockout behind Caddy), SEC-02 enforce blocks on board/project/challenge actions, SEC-03 per-user write throttles + purge job, SEC-04 bind upload size/type (S3 needs createPresignedPost, not PUT), SEC-05 fail prod boot without COOKIE_SECURE + helmet.
- Low: N+1 on /posts/mine and /classes/:id/posts, unbounded People/routeToHelpers scans, forgot mail-bomb, X-Device-Id spoof, inline file serving, web URL sinks without a scheme check (People.tsx:152, Flagship.tsx), admin sees hiddenDetail despite the route summary.
- D15 unscoped lookup list is at the end of REVIEW.md. Did not run `/code-review` or `/security-review` skills; review was by reading code. Done-when stays unchecked until the findings are filed in INDEX and fixed or tracked.
