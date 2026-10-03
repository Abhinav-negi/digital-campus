# CM-01 · Profiles + People search
**Reads:** SPEC §9.1, §9.4 · ARCH §7 (Profile, computed values) · PROTO `student.html:433-465` (people + personSheet), `:118-121` (track record), `:112` (effective availability)
**Owns:** `server/src/modules/commons/profiles.ts`, `server/test/profiles.test.ts`
> All routes sit under `/commons` behind the `commons()` guard (FND-04): students + admins; teachers get 403.

## Endpoints
- `GET /commons/profiles/:userId`: name, branch/year label, availability (**effective**), focusUntil, headline, skills, links, helpsJuniors, track record `{helped, gigsDone, projectsShipped}`, projects, `canAsk` (not self, not focus, no existing conversation), and the conversation state with me. **Never an email.**
- `PATCH /me/profile {headline≤100, skills≤10, links, availability, focusUntil?, helpsJuniors}` (students). Picking Focus without a date defaults to +7 days.
- `GET /commons/people?q=&branchId=&year=&availability=&helpsJuniors=&cursor=`: the PROTO ordering: **Open first, then a round-robin across branches inside each group** (`student.html:438-447`), excluding me and banned users.
- `GET /me/export` (any user, mounted under `/me`, not `/commons`): a JSON download of my user, profile, class memberships, my attendance, projects, posts, conversations, tickets and notifications (SPEC §12).

## Done when
- [ ] Tests: focus past its date reads as open; the people order mixes branches; a teacher → 403; no email in any response.

## Notes
