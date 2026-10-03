# QA-04 · Code review + security review
**Reads:** ARCH §3, §5 (auth) · the whole diff
**Owns:** nothing (it reports findings; fixes become tasks)

## Do
- Run `/code-review high` (correctness) and `/security-review` over the repo. Focus on: the guard coverage, session handling, CSRF on cookie routes, presigned URL scope, the Found `hiddenDetail` leak, the import prompt-injection surface (the model output is only a draft and always zod-validated), rate limits, and N+1 queries on Today/People.
- File each confirmed finding as a task row in INDEX.

## Done when
- [ ] Every confirmed finding is fixed or tracked.

## Notes
