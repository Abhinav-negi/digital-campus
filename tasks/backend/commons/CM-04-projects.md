# CM-04 · Projects, join requests, updates, flagship
**Reads:** SPEC §9.3 · PROTO `student.html:356-404` (cards, flagship hero, sheet, new project), `:600-611` (join / accept)
**Owns:** `server/src/modules/commons/projects.ts`, `server/test/projects.test.ts`
> All routes sit under `/commons` behind the `commons()` guard (FND-04): students + admins; teachers get 403.

## Endpoints
- `GET /commons/projects`: `{flagship, featured[], all[]}`, excluding hidden; each has `crossBranch` (≥2 member branches), member avatars + branch codes, and my state (member / requested / none).
- `POST /commons/projects {title, description, roles[], repoUrl?, status}` → the owner is a member.
- `GET /commons/projects/:id`: the detail + the team + the contribution log + pending requests (owner only).
- `PATCH /commons/projects/:id` (owner) · `DELETE` (owner).
- `POST /commons/projects/:id/join {note?}` (not a member, once pending) → notify the owner.
- `POST /commons/join-requests/:id {state: accepted|declined}` (owner) → accepted adds a member; notify the requester.
- `POST /commons/projects/:id/updates {body}` (members) → source manual.
- `flagship` and `featured` are set **only by the admin** (AD-07).

## Done when
- [ ] Tests: cross-branch computed; a non-owner can't accept; a duplicate pending request → 409.

## Notes
- From CM-01 (S05): validate `repoUrl` as an http(s) URL (`z.url({ protocol: /^https?$/ })`), never a bare string; it's rendered as a link.
- Done S05. Project data: `branches`, `crossBranch`, members (owner first), `me` (member/requested/none). Pending requests are visible to the owner only. List = `featured` (featured + community, featured first) and `all`; no pagination (`ponytail:`). Hidden projects → 404 except for the owner and admins.
- Accept/decline only while pending (conditional update; else 409). Notifications: `project-join` (to the owner) and `project-join-reply`. Made-up limits: title 140, description 2000, roles 10×40, note 300, update 1000.
- JoinRequest "one pending" is check-then-insert (a partial unique index can't be expressed in Prisma); accepting a duplicate fails on ProjectMember's unique index → 409.
- For AD-07: the list takes the newest `flagship`, so `PUT /admin/flagship` must clear the previous one in the same transaction. For CM-08: reuse `projectDetail`, `by`, `byline`, `viewer` from projects.ts.
