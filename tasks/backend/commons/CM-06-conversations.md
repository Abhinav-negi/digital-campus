# CM-06 · Message requests + conversations
**Reads:** SPEC §9.7, §9.2 (post-linked) · ARCH §2 D2 · PROTO `student.html:345-354` (msgPost), `:466-473` (askSheet), `:509-516` (thread), `:617` (accept/ignore)
**Owns:** `server/src/modules/commons/conversations.ts`, `server/test/conversations.test.ts`
> All routes sit under `/commons` behind the `commons()` guard (FND-04): students + admins; teachers get 403.

## Endpoints
- `POST /commons/conversations {toId, note}`: a cold request. Rejected if the target is **Focus** (403 `IN_FOCUS`), blocked either way, self, or there's an existing conversation. **Cap 5 per day per sender** → 429. Notify the recipient.
- `POST /commons/board-posts/:id/message`: post-linked (gig/market/lost/found, not the author): reuse or create an **accepted** conversation, **even if the author is in Focus**, with the PROTO default first line.
- `GET /commons/conversations` → `{incoming[], conversations[], outgoing[]}` (ignored requests older than 7 days dropped; the sender never learns of an ignore).
- `POST /commons/conversations/:id/respond {state: accepted|ignored}` (recipient).
- `GET /commons/conversations/:id/messages` · `POST …/messages {body}` (participants only, accepted only; polled).
- **Admin**: participants-only checks are bypassed for `isAdmin` (D2); the admin's own reading goes through AD-06, which audits it.

## Done when
- [ ] Tests: Focus blocks a cold request but not a post-linked one; the sixth request → 429; a non-participant student → 403; a blocked user can't request.

## Notes
