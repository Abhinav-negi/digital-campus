# CM-03 · Board actions: answers, interest/assign, claims, thanks
**Reads:** SPEC §9.2 (actions), §9.6 · PROTO `student.html:305-339` (bpSheet), `:596-599` (thank/assign/done/confirm), `:630-632` (forms)
**Owns:** `server/src/modules/commons/board-actions.ts`, `server/test/board-actions.test.ts`
> All routes sit under `/commons` behind the `commons()` guard (FND-04): students + admins; teachers get 403.

## Endpoints
- `POST /commons/board-posts/:id/answers {body}` (ask, open) → notify the author.
- `POST /commons/board-posts/:id/interests {note}` (gig, open, not the author, once) → notify the author.
- `POST /commons/board-posts/:id/assign {userId}` (author; the user must be interested) → `assigned`, notify.
- `POST /commons/board-posts/:id/done` (author, assigned) → `done` + an automatic Thanks to the assignee.
- `POST /commons/board-posts/:id/claims {answer}` (found, open, once) → notify the finder.
- `POST /commons/board-posts/:id/claims/:claimId/confirm` (author) → `returned`, the other claims declined, notify.
- `POST /commons/thanks {postId, toId}` (the post author, the post closed, `toId` helped: answered / assignee / claimer; once per pair) → notify ("You were thanked").
- Post-linked messages are in CM-06.

## Done when
- [ ] Tests: only the author can assign, confirm or thank; a duplicate thanks → 409; thanks count in the profile track record.

## Notes
