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
