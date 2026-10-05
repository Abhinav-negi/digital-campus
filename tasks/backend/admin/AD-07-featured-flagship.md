# AD-07 · Featured + flagship
**Reads:** SPEC §10 Admin (Featured), §9.3 (flagship), Q11 · PROTO `admin.html:101-108`, `:129-133`
**Owns:** `server/src/modules/admin/featured.ts`, `server/test/featured.test.ts`

## Endpoints
- `GET /admin/featured` → projects + challenges with flags, `used/3`.
- `PUT /admin/featured/:type/:id {featured}`: at most **3** featured across projects and challenges (409 "Only 3 can be featured. Unstar one first.").
- `PUT /admin/flagship {projectId}`: exactly one flagship (unset the previous).

## Done when
- [ ] Tests: a fourth feature → 409; setting the flagship moves the flag.

## Notes
- S08 ✅ `pg_advisory_xact_lock(7007)` serialises the cap check and the flagship swap. Hidden items are left out of the list/count and return 404.
- Featuring or unfeaturing the current flagship → 409 `FLAGSHIP`. Setting the flagship doesn't touch `featured`. The seed fills the cap (pr0 flagship, pr1, pr3).
