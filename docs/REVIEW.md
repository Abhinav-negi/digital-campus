# QA-04 code + security review

Scope: `server/src` (all modules), `web/src` XSS sinks. QA-01's `wall.test.ts` already proves every route x role status, so this review covers what a status table cannot see: ownership/membership, tokens, CSRF, uploads, leaks, throttles, query shape. Every handler in `server/src/modules/**` was read. Live checks ran against the dev API (:3000) and left no data behind (one uploaded test file, removed; one session, logged out).

**Result: 0 high, 5 med, 8 low.** No IDOR, auth bypass, SQL injection, path traversal or stored-XSS path was found. The med items are availability/abuse gaps and one production-config trap.

Legend: CONFIRMED = reproduced live, or the code path is unambiguous. PLAUSIBLE = depends on a deployment or client condition.

---

## Findings

### R1 (med) No `trust proxy`: every per-IP limiter keys on the reverse proxy's address in production
- **Where:** `server/src/app.ts:54-58` (no `app.set('trust proxy', ...)`), `server/src/lib/auth.ts:188` (`req.ip`), `server/src/modules/auth/routes.ts:66` (`rateLimit(300, WINDOW)`), `:125` (forgot 30/min), `admin/users.ts:263` (DELETE /me).
- **Wrong:** DEPLOY-CHECKLIST puts Caddy in front (OPS-04 VPS variant, and Render/Railway/Fly also proxy). Express then sees the proxy IP for every request.
- **Scenario:** the "loose per-IP ceiling" of D18 (300 logins / 15 min) becomes a campus-wide ceiling. About 300 logins between 08:30 and 08:45 (one lecture-hall start) and the next student gets 429 for 15 min. Also, one attacker burns that shared budget on purpose to lock everyone out of login. The same applies to `/auth/forgot` (30/min global).
- **Status:** CONFIRMED (code). It is invisible in dev and tests because there is no proxy.
- **Fix / task:** `SEC-01 Trust the reverse proxy for rate-limit IPs`. Add a `TRUST_PROXY` env (hop count, default 0, set 1 behind Caddy) and call `app.set('trust proxy', n)`. Do not use `true` (lets clients spoof `X-Forwarded-For`). Add the var to `.env.example` and DEPLOY-CHECKLIST.

### R2 (med) Blocks are not enforced on Commons actions or on direct reads, only on lists and messaging
- **Where:** `commons/board-actions.ts` (answers, interests, claims, assign, thanks), `commons/projects.ts` (`/projects/:id/join`), `commons/challenges.ts` (submissions, likes), `commons/board.ts:146 findPost`, `projects.ts findProject`. `blockedIds` is used only in `board.ts:240` (list), `profiles.ts` (people/profile), `conversations.ts`, `card.ts`.
- **Wrong:** A blocks B. B can still open A's post/project by id, answer A's Ask, say "interested" on A's gig, claim A's Found item, ask to join A's project (300-char note). Each call sends A a notification (`notify([p.authorId], ...)`). `card.ts` hides blocked people's answers from A's dashboard card, but the notification and the post detail still show them.
- **Scenario:** a harassed student blocks the harasser, who keeps writing to them through public-post answers and join notes; the block gives no relief from notifications.
- **Status:** CONFIRMED (code: no `blocked*` call on those paths).
- **Fix / task:** `SEC-02 Enforce blocks on Commons write actions`. In `findPost`/`findProject`/`findChallenge` take `me` and 404 when `blockedEitherWay(me, owner)`; skip `notify` for blocked pairs. One helper, one call per finder.

### R3 (med) Nothing throttles content-creating endpoints, so one account can flood another's notifications and the DB
- **Where:** `conversations.ts:237 POST /conversations/:id/messages`, `board-actions.ts` answers (no unique, no cap), `tickets/routes.ts` create + reply, `posts/routes.ts:180 /posts/:id/remind` (re-notifies every unseen student each call, no cooldown), `classes/members.ts:140 /invites/resend` (re-emails), `/files/presign`.
- **Wrong:** only board posts (5/day), message requests (5/day) and a few auth routes have caps. Every message/answer writes a `Notification` row to the other person; `Notification`, `LoginSession` and `PasswordReset` rows are never purged (no job in `jobs.ts`).
- **Scenario:** a student loops `POST /conversations/:id/messages` 10k times: the recipient's bell shows thousands of items, the table grows without bound. A teacher presses Remind in a loop and spams a whole class; a class teacher loops invite-resend and mails one pending student continuously from the institution's SMTP sender.
- **Status:** CONFIRMED (code).
- **Fix / task:** `SEC-03 Per-user write throttles + retention job`. Reuse `rateLimit(max, window, keyOf)` with `keyOf = req.user.id` on those routes (e.g. messages 30/min, remind 1 per post per hour via the audit row, resend 1 per user per hour). Add a nightly `purgeExpired` job: sessions/resets past expiry, read notifications older than 90 days.

### R4 (med) Presigned upload limits are not enforceable as designed, and the real S3 driver would inherit that
- **Where:** `lib/storage.ts:47` (`presignPut(key, _contentType)` ignores type and size), `files/routes.ts:58-64` (local PUT), `files/routes.ts:21-33` (presign).
- **Wrong:** the 15 MB / type allow-list is checked only at `POST /files/presign` against *claimed* values. The signature covers method + key + expiry only. Reproduced live: presigned a `.pdf` for `size: 10`, PUT an HTML body to it -> 200; PUT again to the same URL -> 200 (overwrite, valid until expiry). Bytes are never checked against the declared type or size. A presigned S3 `PUT` cannot bound size either (only `Content-Length` header, not signed to a range), so the missing S3 driver (`s3()` throws) must not be written as a straight port.
- **Scenario:** any logged-in user mints unlimited presigns, uploads 15 MB each to disk, never attaches them; nothing sweeps orphans (`board.ts` delete says so). The served file type follows the key's extension with `nosniff`, so a mislabelled body is not directly exploitable, but it is served inline from the app origin (see R10).
- **Status:** CONFIRMED (local driver). The S3 part is PLAUSIBLE (driver not written).
- **Fix / task:** `SEC-04 Bind upload type/size, cap per user`. Local: in the PUT handler, reject `Content-Length` over the signed size and sniff magic bytes against the extension; one-time URL (record used `sig`). S3: use `createPresignedPost` with `content-length-range` + `Content-Type` condition, not a presigned PUT. Add a per-user presign rate limit and a job that deletes keys unreferenced after 24 h.

### R5 (med) Production cookie flag and headers rely on remembering env vars
- **Where:** `config.ts:10` (`COOKIE_SECURE` default `false`), `lib/auth.ts:75`, `app.ts` (no `helmet`; `package.json` has no helmet/cors).
- **Wrong:** `NODE_ENV=production` with `COOKIE_SECURE` unset boots fine and issues the session cookie without `Secure`. There is no HSTS, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options` (only set on file GET) or CSP on the SPA, so any page can iframe the app (clickjacking on one-tap actions such as Confirm claim, Save attendance). Also APP_URL must equal the browser origin exactly (www vs apex) or *every* cookie write 403s CSRF; the checklist does not say so.
- **Status:** CONFIRMED (code). Cookie itself is correct in dev: `HttpOnly; SameSite=Lax` seen live.
- **Fix / task:** `SEC-05 Prod config guards + security headers`. In `config.ts` fail startup if `NODE_ENV=production && !COOKIE_SECURE`; add `helmet()` (HSTS, frame-ancestors 'self', nosniff, a CSP that allows the Vite build); document the APP_URL rule.

---

### R6 (low) `/posts/mine` and `/classes/:id/posts` are N+1 (2 counts per post, up to 100 posts)
- `posts/routes.ts:62-65, 152, 233`: `stats()` runs two `count` queries per post inside `Promise.all(rows.map(...))`, so a page of 100 is up to 200 queries per request, by teachers on a polled screen. It is a known `ponytail:` note but has no ceiling guard.
- CONFIRMED (code). Fix `PERF-01 Grouped seen-stats query`: one `groupBy` for seen per postId and one count per distinct class set.

### R7 (low) Unbounded reads that grow with the school
- `commons/profiles.ts:162` People search loads every student of the institution and filters/sorts in memory on every request (documented ceiling "thousands"). `commons/board.ts:349 routeToHelpers` does the same full scan on every new Ask/Gig (5 per student per day). `commons/card.ts` (all open asks and projects), `projects.ts GET /projects`, `challenges.ts GET /challenges`, `classes/board.ts GET /board` (notices and files never expire), `jobs.ts attendanceDigest` (queries per subject and per low student).
- `/me/today` is clean: a fixed ~12 queries for a student, `decorate` runs one extra query.
- CONFIRMED (code), no failure at demo scale. Fix `PERF-02 Page or index the big Commons reads`: SQL `ILIKE` + keyset cursor for People, a skills `hasSome` filter in `routeToHelpers`, `take` caps on the others.

### R8 (low) Account lockout and mail-bomb trade-offs in the auth limiter (D18 follow-ups)
- `auth/routes.ts:66-69`: 30 bad attempts per 15 min per email locks that account for everyone, including the chief admin (accepted in D18). `:128` forgot allows 10 mails/min per email, i.e. 600 reset mails an hour to one victim; each call also writes a `PasswordReset` row.
- CONFIRMED (code). Fix (can fold into SEC-03): forgot 3 per 15 min per email; do not count successful logins; consider exempting the chief from the shared counter via a second factor later.

### R9 (low) Check-in code: rate limit is adequate, device flag is client-controlled
- `attendance/code.ts` limits 5 wrong guesses/min per student, counted before any await, and the success path refunds. One account gets about 10 guesses x 2 live codes (current + previous step) out of 10,000 in a 2-minute window = 0.2%, fine.
- `app.ts:58` trusts `X-Device-Id` from the client: a student can send a fresh id to dodge the "same device for two accounts" flag, or send a classmate's id to flag them. The flag is advisory ("never rejects"), so impact is false positives/negatives in the teacher's review only.
- PLAUSIBLE (needs a hostile student). Accept, or derive the flag from IP + UA too. Remote check-in with a relayed code is inherent to a 4-digit code.

### R10 (low) Uploaded files are served inline from the app origin
- `files/routes.ts:66-72`: `res.sendFile` with `nosniff` but no `Content-Disposition` and no `Content-Security-Policy: sandbox`. Allowed types are pdf/png/jpg/webp/zip, none of which run script by default, but a PDF opens inline on the app origin. Same-site cookie is HttpOnly so the blast radius is small.
- CONFIRMED (code). Fix (fold into SEC-04): `Content-Disposition: attachment` for zip/pdf, `Content-Security-Policy: sandbox` on all file responses; in S3, use a separate bucket domain.

### R11 (low) Account enumeration by class teachers; invite-preview is an oracle
- `classes/members.ts:57-71` + `POST /classes/:id/invites {dryRun:true}` returns `Duplicate` for any email or student ID that already exists anywhere in the deployment. A class teacher can test "does user X exist" for arbitrary emails (up to 500 per call, no limit). Login/forgot are correctly uniform.
- CONFIRMED (code). Accept (staff are trusted), or limit the dry run to 100 rows and rate-limit it.

### R12 (low) Defence-in-depth on user URLs in the web app
- Server validates `http(s)` on write for `repoUrl`, `Submission.url` and profile `links.other` (and re-validates `links` on read with `safeParse`), so there is no known stored XSS. The web side only repeats the check in two of four places: `ProjectSheet.tsx:34` and `ChallengeSheet.tsx:41` check `^https?://`; `commons/people/People.tsx:152` (`href={u}` for `links.other`) and `commons/build/Flagship.tsx:7-23` (`window.open(repo)` / `${repo}/issues`) do not. The S10 repoUrl comment says old seed rows may lack a scheme.
- `Icon.tsx:34` `dangerouslySetInnerHTML` renders only the constant icon table `P[name]`, never user data. No other HTML sinks (`innerHTML`, `srcDoc`, `eval`) in `web/src`.
- PLAUSIBLE (only if a bad row ever got in). Fix `WEB-xx Share one safeHref()` used by all four sinks.

### R13 (low) Smaller notes
- `GET /commons/board-posts/:id` for a Found post returns `hiddenDetail` to the author **and any admin** (`board.ts:180` `full = mine || me.isAdmin`); the route summary says "only for the author". Decide, then fix the summary or the code. (Admin read of conversations is audited per D2; this is not.)
- Any admin can disable or delete another non-chief admin (`admin/users.ts` status and DELETE); there is no admin-management route, so it is by design but unaudited as a privilege action beyond the existing audit rows.
- `findConversation` returns 403 for a non-participant and 404 for a missing id (`conversations.ts`): an id-existence oracle for 25-char cuids, not practically exploitable.
- Reports: three distinct reporters auto-hide a post/project/challenge (`safety.ts` HIDE_AT). Three colluding or sock-puppet accounts can hide anyone's content until an admin reviews; known trade-off.

---

## D15 list (what must gain `institutionId` scoping before multi-institution)
Already scoped by institution: all Commons reads, `admin/users GET`, `students.ts`, `school.ts`, `audit.ts`, `moderation.ts` bans and conversations. **Not scoped** (use the raw id): `admin/users.ts` PATCH status, POST reset-password, DELETE; `admin/inbox.ts` (tickets, reports); `admin/moderation.ts find()` and report actions; `admin/featured.ts`; `staff/routes.ts GET /staff`; `classes/routes.ts POST /` (branchId) and `/handover` (teacherId); `classes/subjects.ts assertTeacher`; `classes/imports/routes.ts` staff lookups and `applyTimetable` teacherIds; `posts/routes.ts` create (classIds are checked by teaching, fine). Unchanged at one institution per deployment (DEPLOY-CHECKLIST).

---

## Checked and found clean
1. **Guard coverage / IDOR:** every class sub-route pairs `classAccess` with an id-in-class lookup (`findFirst({id, classId})`): subjects, timetable slots, schedule changes (slot must be in the class's active term), board items, members, attendance (`subjectId` must belong to the class). Ids in bodies are re-validated: `fileKey` (`ownKey`), `subjectId` (class + active term), `teacherId` (active staff), `classIds` on posts (teacher must teach each), imports `apply` (draft ids re-checked in `board.create`/`applyTimetable`), `/board/from-post` (`postTarget` in the class), `assign` (must be an interested user), `thanks` (must be a helper), `winners` (must have submitted), CR picks (must be class members). Tickets, reminders, notifications, own-post stats are owner-filtered in the query itself.
2. **Admin routes:** `router.use(admin())` covers all of `/admin`; client ids are resolved server-side (target looked up, institution filter where it matters), chief protected from disable/delete, deleted accounts are inert.
3. **Sessions:** `HttpOnly; SameSite=Lax; Path=/`, `Secure` via env (see R5). Login always mints a fresh 256-bit token and ignores any incoming cookie (no fixation). Tokens stored as SHA-256. Logout deletes the row (verified live: `/auth/me` -> 401 afterwards). Disable, delete and password reset delete all sessions. Reset token: 256-bit, 1 h, single use via conditional `updateMany` in a transaction. Invite token: single use via conditional update, re-invite replaces the old token, expired -> 410. Disabled/invited users cannot log in; unknown email costs the same scrypt (dummy hash). Role/ban changes take effect on the next request (user loaded per request).
4. **CSRF:** the Origin check runs for every cookie-authenticated request that is not GET/HEAD/OPTIONS, in `authenticate()`, which all guards and `/auth/me` use. A missing Origin is rejected (verified live: POST without Origin -> `403 CSRF`; with `http://localhost:5173` -> 200). Bearer-token clients skip it (no ambient credential). Public POSTs (login, forgot, reset, invite accept) are intentionally exempt; they carry no session, so the only residual is login-CSRF, which needs the victim to be logged in with the attacker's credentials and has no data effect. No GET route mutates data (only sliding expiry and ban lift in `authenticate`).
5. **Presigned URLs:** keys are server-built `uploads/<userId>/<uuid>-<name>.<ext>` and the name is reduced to `[\w-]`; HMAC covers method + key + expiry (a PUT signature does not open GET: verified 403). `..` in the path -> 403 (verified), `localPath` does a prefix check, `sendFile` is rooted. Attaching a file requires `ownKey` (own prefix + strict filename regex), so nobody can attach or read another user's key. GET links last 15 min and are minted only when a viewer already passed the class/post guard. Weak points are R4 and R10.
6. **Found `hiddenDetail`:** the only read of the column is `board.ts:180`; list cards (`toPostCard`), card, export of others, notifications, audit rows and admin moderation patch do not include it. Author and admin only (see R13). Claimants never see it, and a claim does not reveal whether the answer matched.
7. **Rate limits:** login (3 layers), forgot, `DELETE /me`, check-in guesses, posts/day and requests/day are in place. Invite token and reset token endpoints are unthrottled but guess-proof (256-bit).
8. **XSS / injection:** React text escaping everywhere; no raw SQL (only `$executeRaw` tagged templates for advisory locks); no `exec`/`spawn`; zod on every body/query/param; JSON import parsing is bounded by the 1 MB body limit.
9. **Today:** `/me/today` student path is a fixed set of queries; `myAttendance` and `upcoming` are batched.
