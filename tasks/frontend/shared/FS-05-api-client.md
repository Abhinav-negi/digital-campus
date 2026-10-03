# FS-05 · API client + query hooks
**Reads:** ARCH §8 (conventions), §14 · FND-07
**Owns:** `web/src/api/{client,hooks}.ts`

## Do
- `openapi-fetch` client typed by `schema.d.ts`, with `credentials:'include'`, an `X-Device-Id` header (uuid kept in localStorage, wrapped in try/catch), and errors mapped to `{code, message}`.
- Conventions for area agents: one hook file per area (`routes/<area>/queries.ts`); query keys `[module, ...params]`; mutations invalidate the related keys and toast the PROTO success copy; a 401 → redirect to login; a 403 → toast the message.
- `usePoll(key, ms)` helper for the check-in list and messages.

## Done when
- [ ] A sample hook (`useMe`) is typed end to end; changing a server schema + `gen:api` breaks the TS build where it should.

## Notes
