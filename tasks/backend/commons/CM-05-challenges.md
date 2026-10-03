# CM-05 · Challenges, submissions, likes, winners
**Reads:** SPEC §9.3 (Challenges) · PROTO `student.html:405-432`, `:612` (like), `:634` (submit)
**Owns:** `server/src/modules/commons/challenges.ts`, `server/test/challenges.test.ts`
> All routes sit under `/commons` behind the `commons()` guard (FND-04): students + admins; teachers get 403.

## Endpoints
- `GET /commons/challenges`: live first then ended, with submission counts and `winners` (computed: `winnerIds` if set, else the most likes once ended when judging=likes).
- `POST /commons/challenges {title, description, endsAt, judging}`.
- `GET /commons/challenges/:id`: submissions sorted by likes, `likedByMe`.
- `POST /commons/challenges/:id/submissions {url, note?}` (live, once per user).
- `POST /commons/submissions/:id/like` (toggle, live only).
- `PUT /commons/challenges/:id/winners {userIds[]}` (owner, judging=owner, after it ends).

## Done when
- [ ] Tests: likes are frozen after the end; the likes winner is computed; a second submission → 409.

## Notes
