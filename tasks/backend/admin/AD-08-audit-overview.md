# AD-08 · Audit log + overview
**Reads:** ARCH §3 (audit) · PROTO `admin.html:65-74` (overview stats)
**Owns:** `server/src/modules/admin/{audit,overview}.ts`, `server/test/admin-audit.test.ts`

## Endpoints
- `GET /admin/audit?actorId=&classId=&action=&from=&to=&cursor=`: newest first, with actor names and a readable `detail`.
- `GET /admin/overview` → students per branch, board posts per kind this week, open tickets, open reports, pending invites, classes without a timetable (D9 health).

## Done when
- [ ] Tests: the filters work; overview numbers match the seed.

## Notes
