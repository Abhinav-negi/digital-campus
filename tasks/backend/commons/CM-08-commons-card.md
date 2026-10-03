# CM-08 · "From the Commons" dashboard card
**Reads:** SPEC §7.3 item 5 · PROTO `student.html:178-193` (commonsCard logic + rotation)
**Owns:** `server/src/modules/commons/card.ts`, `server/test/card.test.ts`
> All routes sit under `/commons` behind the `commons()` guard (FND-04): students + admins; teachers get 403.

## Endpoints
- `GET /commons/card` → an ordered list (the client rotates through it, "Next · 1 of n"): ① the latest answer on my Ask; ② pending join requests on my projects; ③ an unanswered ask or gig matching my skills; ④ a project matching my skills (or any looking project). Each is `{type, title, body, refId, byline?}`.

## Done when
- [ ] Tests: the seed student Riya gets the same card types the prototype shows.

## Notes
