# Digital Campus: Architecture

> The overview of the whole system. Task files cite sections as **ARCH §n**, so read only the sections a task names.
> Product spec: `../Digital_Campus.md` (cited as **SPEC §n**). Visual system: `DESIGN.md`. Prototype: `../digital-campus-mvp/` (cited as **PROTO file:lines**).
> **If this file and SPEC disagree, this file wins** until task `DOC-01` syncs the spec.

---

## 1. Overview
Digital Campus is one app with two spaces for a School of Engineering & Technology (SoET: CSE, IT, ECE, ME, IE; years 1–4):
- **Class space.** The official room of one batch: timetable, syllabus, exams, deadlines, notices, files, teacher posts, attendance. The **CR keeps it current**, teachers post into it and take attendance.
- **Commons.** A students-only block for the whole school: the Board (Ask · Gig · Market · Lost · Found), Build (projects, the flagship, challenges), People, and message requests.
- **Admin.** The chief of the system, with full power over people, classes and the Commons, plus an inbox for issues.

Architecture in one line: **one TypeScript monorepo → one container (REST API + static PWA) → Postgres + S3 + SMTP**, with a versioned REST contract (OpenAPI) that the web app and a future Flutter app both consume.

---

## 2. Decisions (D-numbers are cited by tasks)
| # | Decision |
|---|---|
| D1 | **Admin is a badge on a staff account** (`isAdmin`). The seeded **chief** (`isChief`) can't be demoted. **Any admin** can grant or revoke the badge. |
| D2 | **Admin has full power**: users, school setup, every class (board, roster, CR, class teacher, attendance corrections, promotion), and **everything in the Commons, including private conversations**. Every admin write is audit-logged with before/after. Students see a notice that admins can see Commons activity. |
| D3 | **Only the admin creates teacher accounts** (email invite). There is no teacher self-sign-up. |
| D4 | **A teacher creates a class (a batch)** and invites students by ID + email. A student opens the link, sets a password, and is in. Each student is **locked to their batch** (`homeClassId`); only the admin can move them. |
| D5 | **Batch promotion.** The class teacher (or admin) taps **Start next semester** after exams: the semester goes +1, `yearOfStudy = ceil(semester/2)`, the roster carries over, and the old term stays viewable read-only. After semester 8: **Graduate** → archived; students keep their Commons profile. |
| D6 | **Admin inbox.** Any student or teacher can open a **ticket** (request or issue). The admin replies. Commons **reports** appear in the same inbox. |
| D7 | **The CR fills the class.** The CR (or class teacher) creates subjects and picks each subject's teacher from the **staff directory**. That teacher is **auto-allotted**: the class appears on their dashboard, and they get a notification with a **"Not me"** button (it unassigns them and tells the CR). |
| D8 | **Import via any chatbot (S06, was the Claude API).** The app shows a ready-made prompt per kind (timetable / syllabus / datesheet). The CR gives it + their PDF or photo to any chatbot (ChatGPT, Gemini, Claude), pastes back the JSON → the server validates it → **editable preview** (unmatched teachers and bad rows highlighted) → confirm. No API key, no cost, no AI in the server; manual entry still works. |
| D9 | **Friendly empty states.** Anything not yet added shows a placeholder such as "Your CR will add the timetable soon". |
| D10 | **The timetable follows reality.** Weekly slots are the base, plus **per-date changes** (cancel, move, extra class, event). The CR edits the week ahead; a teacher cancels or postpones **their own** class (later today or another date). |
| D11 | **Clashes are allowed, never blocked.** Overlaps within one class, or one teacher in two classes, are computed on read and shown as a **Clash** badge. Both teachers are notified ("who's taking it?") with Cancel / Postpone. The clash clears when one acts; otherwise it stays as information. |
| D12 | Scope v1 = **full prototype parity**. Deferred: GitHub commit sync, the LeetCode summary, web push, offline attendance sync (see §15). |
| D13 | Later: **branch-scoped admins** (HOD per branch). |
| D14 | **No Docker anywhere** (S04). Dev Postgres 17 = `npm run db:start` (`embedded-postgres`, no sudo). `SMTP_HOST` empty → emails are printed to the server log. `S3_ENDPOINT` empty → files live on local disk (`.data/uploads`) behind the same presign API. Prod is a plain Node process (`npm run build && npm start`); every host above runs Node natively. Prod still switches by env vars only. |
| D16 | **Project-ready first, ship-ready later (S06).** Build and verify everything on localhost (local Postgres, local disk files, real email via Gmail SMTP). Deployment-only work (prod build, deploy guide, CI, S3 driver, prod smoke) is parked in INDEX "Deployment (later)" and listed in `docs/DEPLOY-CHECKLIST.md`. Code still switches by env vars only, so nothing is removed. |
| D15 | **One institution per deployment in v1.** `institutionId` stays on top-level rows (ARCH §7), but admin queries are not scoped by it. Turning on multi-institution means scoping every admin and staff lookup by `institutionId` first (QA-04 checks this). |
| D17 | **An invited student may be CR (S09, user decision).** The new-class wizard picks the CR before anyone has accepted an invite. `PUT /classes/:id/cr` accepts active or invited members (disabled refused); the role sits on `ClassMember`, so it takes effect when they accept. |
| D18 | **Login limiter keyed on IP + email (S12).** A lab logs in from one NAT address, so the login limiter counts per (IP, normalised email) with a loose per-IP ceiling (300/15 min) and a per-account ceiling across IPs (30/15 min; the accepted cost is that someone can lock one account for 15 min). Forgot: 30/min per IP + 10/min per email. Keys are length-bounded and the in-memory map is hard-capped (single process only). Found by QA-02a (F7); hardened after the S12 security review. FND-10 adds per-user write throttles (`perUser`: messages/answers/tickets/presign 30/min, invite resend 20/h, remind 5/h per post; forgot also 3 per 15 min per email) and a daily 03:10 `purgeStale` job (read notifications >90 d, expired sessions, used-and-expired reset/invite tokens). |
| D19 | Accepted (S12 review): the check-in X-Device-Id is a same-device hint, not proof; class teachers can learn whether an email already has an account via the invite dry run. |

---

## 3. Roles and the wall
| Capability | Student | CR | Teacher (staff) | Admin |
|---|---|---|---|---|
| Read class board/posts | own batch | own batch | classes they're in | all |
| Edit board, subjects, timetable, week-ahead changes, import | — | ✅ own batch | class teacher ✅ | ✅ |
| Cancel/postpone a slot | — | ✅ (class) | **own subjects** (class teacher: all) | ✅ |
| Take/correct attendance | — | **❌ never** | own subjects (class teacher: all) | ✅ (audited) |
| See attendance | own only | own only | their subjects / class teacher: all | all |
| Roster with emails | names | names | ✅ | ✅ |
| Create class, invite students, make CR, promote | — | — | ✅ (class teacher for own) | ✅ |
| **Commons** | ✅ | ✅ | **❌ 403** | ✅ full, including conversations |
| Tickets to admin | ✅ | ✅ | ✅ | answers them |
| Users, school, badge, audit | — | — | — | ✅ |

**Enforcement (server side, in `server/src/lib/auth.ts`):**
- `auth()`: logged in, not disabled.
- `staff()`, `admin()`, `chief()`.
- **`commons()`**: `role === 'student' || isAdmin`. **The whole Commons router is mounted behind it.** This is the wall.
- `classAccess(classId, need)`, with `need ∈ 'read' | 'board' | 'teach' | 'own'`, reads `ClassMember` + `Subject.teacherId`. **`isAdmin` passes every check.**
- `audit(req, action, target, before, after)` is called by every admin-power write and every board/attendance edit.

---

## 4. System diagram
```
 ┌──────────── clients ────────────┐
 │ Web PWA (React)    Flutter (later)│
 │ cookie session     Bearer token   │
 └───────┬───────────────┬──────────┘
         │  HTTPS /api/v1 (JSON, OpenAPI)
 ┌───────▼───────────────▼─────────────────────────┐
 │ Node 24 · Express 5 (one Node process)           │
 │  /api/v1/*  modules → zod → Prisma               │
 │  /*         static web/dist (PWA)                │
 │  node-cron  reminders · expiry nudges            │
 └──┬──────────┬───────────┬──────────────────────┘
    │          │           │
 Postgres   S3 / disk    SMTP / log
 (Prisma)  (presigned    (invites,
           uploads)      resets)
```
Realtime = **polling** (check-in list every 2s, seen counts and notifications every 30s). There's no socket server.

---

## 5. Stack
| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict) everywhere, Node 24 | npm workspaces: `server`, `web` |
| API | **Express 5**, **zod** for every input, `@asteasolutions/zod-to-openapi` → `GET /api/v1/openapi.json` | |
| DB | **PostgreSQL 17 + Prisma** | migrations in `server/prisma/migrations` |
| Auth | opaque session token (32 random bytes; SHA-256 stored in `LoginSession`; 30-day sliding). Web: httpOnly `SameSite=Lax` cookie + Origin check on writes. App: `Authorization: Bearer`. Passwords: `node:crypto` scrypt. `express-rate-limit` on auth routes. | |
| Email | nodemailer → server log (dev, `jsonTransport`) / SMTP (prod) | D14 |
| Files | `@aws-sdk/client-s3` + presigner → S3 or R2 (prod); local disk + HMAC-signed URLs (dev, tests) | client PUTs directly; D14 |
| Import | No SDK. Prompt texts served by the API; the pasted chatbot JSON is zod-validated | D8 |
| Jobs | `node-cron` in-process | `ponytail:` single instance; pg-boss if scaled out |
| Web | React 19, Vite, react-router, TanStack Query, `openapi-fetch` + `openapi-typescript`, `vite-plugin-pwa`, `@fontsource/josefin-sans` | **No Tailwind**: `style.css` is ported verbatim (DESIGN.md) |
| Avatars | DiceBear `notionists` URL + initials fallback (same as PROTO data.js:329-334) | |
| Tests | `node:test` + `supertest` on a separate test DB | |
| Dev infra | `npm run db:start`: Postgres 17 via `embedded-postgres` (dbs `campus` + `campus_test`, data in `.data/pg`). No Docker | D14 |

---

## 6. Repo layout
```
digital-campus/
  ORCHESTRATOR.md  ARCHITECTURE.md  DESIGN.md  INDEX.md  handoff/  tasks/
  package.json            workspaces + root scripts (dev, test, db:start, db:reset, gen:api, build, start)
  scripts/db.mjs          local Postgres (D14) · .data/ (gitignored: pg data, uploads)
  .env.example  README.md  docs/DEPLOY.md
  server/
    prisma/schema.prisma  prisma/seed.ts
    src/index.ts          boot: config → app.listen → jobs
    src/app.ts            express, /api/v1 router registry, error handler, static web
    src/config.ts         zod-parsed env
    src/jobs.ts
    src/lib/              db · auth · http (validate, errors, paginate) · audit · notify · mail · storage · openapi · dates (institution tz)
    src/modules/<name>/routes.ts   (+ service.ts only when logic is non-trivial; pure maths in <name>/math.ts with tests)
    test/                 helpers.ts (reset DB, loginAs(role)) · <module>.test.ts
  web/
    vite.config.ts  index.html  public/ (manifest icons)
    src/main.tsx  src/router.tsx
    src/styles/style.css           ← verbatim port + per-page styles from PROTO <style> blocks
    src/api/schema.d.ts (generated) · client.ts · hooks.ts
    src/ui/                        Icon Avatar Sheet FormSheet Toast Tabs Badge Empty Bar AppShell
    src/lib/dates.ts               fmt / rel (PROTO data.js:323-324)
    src/routes/landing · auth · onboarding · student/* · teacher/* · admin/*
```
**Shared files only the orchestrator edits:** `prisma/schema.prisma`, `src/app.ts` router registry, root `package.json`, `INDEX.md`. Agents report needed changes instead of editing them.

---

## 7. Data model
Conventions: `id` = cuid, `createdAt`/`updatedAt` on every table, `institutionId` on top-level rows (multi-institution ready), calendar dates as `@db.Date`, times as `"HH:MM"` strings in the institution timezone.

```
Institution(name, timezone="Asia/Kolkata")
Branch(institutionId, code, name)                                   -- CSE, IT, ECE, ME, IE
User(institutionId, role[student|staff], isAdmin, isChief, name, email UNIQUE, passwordHash?,
     status[invited|active|disabled], bannedAt?, homeClassId?, studentIdNo?, dept?)
LoginSession(userId, tokenHash, expiresAt, userAgent, deviceId?)
Invite(email, role, classId?, invitedById, tokenHash, expiresAt, acceptedAt?)      -- 14-day expiry
PasswordReset(userId, tokenHash, expiresAt, usedAt?)

Class(institutionId, branchId, admissionYear, section, name, classTeacherId, minAttendancePct=75, archivedAt?)
Term(classId, semester 1..8, yearOfStudy, startedAt, endedAt?)      -- one active (endedAt null) per class
ClassMember(classId, userId, role[student|cr|teacher])              -- teachers are added by subject allotment
Subject(termId, classId, name, code?, teacherId?, assignedById)
TimetableSlot(termId, classId, subjectId, weekday 1..6, start, end, room?)
ScheduleChange(classId, termId, date, slotId?, kind[cancelled|moved|extra|event],
               subjectId?, title?, start?, end?, room?, movedToDate?, note?, authorId)
BoardItem(termId?, classId, kind[notice|syllabus|exam|deadline|file], subjectId?, title, body?,
          units[]?, fileKey?, fileName?, date?, pinned, authorId)  -- notices/files: termId null = persist across terms
Post(authorId, kind[announcement|assignment], title, body, fileKey?, fileName?, dueAt?, repliesOn=false)
PostTarget(postId, classId) · PostSeen(postId, userId, seenAt)
Reminder(teacherId, title, date)

AttendanceSession(termId, subjectId, slotId?, date, method[roll|code], codeSecret?, codeOpenedAt?, savedById?, savedAt?)
Attendance(sessionId, studentId, present, source[teacher|code], flagged, deviceId?)   UNIQUE(sessionId, studentId)

Profile(userId PK, headline, availability[open|questions|focus], focusUntil?, helpsJuniors,
        skills[], links Json{github,leetcode,linkedin,other[]})
BoardPost(authorId, kind[ask|gig|market|lost|found], title, body?, photos[], tags[], price?,
          priceType[fixed|negotiable]?, marketType[sell|buy|give|lend]?, condition?, place?, happenedOn?,
          holder?, hiddenDetail?, deadline?, status[open|assigned|solved|done|sold|given|returned|expired],
          assigneeId?, expiresAt, hiddenAt?)
Answer(postId, authorId, body) · Interest(postId, userId, note) · Claim(postId, userId, answer, state[pending|confirmed|declined])
Thanks(fromId, toId, postId?)
Project(ownerId, title, description, roles[], repoUrl?, status[looking|building|shipped], community, featured, flagship, hiddenAt?)
ProjectMember(projectId, userId, role) · JoinRequest(projectId, userId, note?, state[pending|accepted|declined])
ProjectUpdate(projectId, authorId, body, source[manual|github])
Challenge(ownerId, title, description, endsAt, judging[owner|likes], winnerIds[], featured, hiddenAt?)
Submission(challengeId, userId, url, note?) · SubmissionLike(submissionId, userId)
Conversation(fromId, toId, note, postId?, state[requested|accepted|ignored]) · Message(conversationId, senderId, body)
Block(userId, blockedId) · Report(reporterId, targetType[board|project|challenge|message|profile], targetId, reason, state[open|hidden|warned|dismissed])

Ticket(fromId, category[account|class|attendance|commons|bug|other], subject, body, state[open|answered|closed])
TicketReply(ticketId, authorId, body)
Notification(userId, type, payload Json, readAt?)
AuditLog(actorId, classId?, action, targetType, targetId, before Json?, after Json?)
```
**Computed on read, never stored:** attendance %, its status and its text (PROTO data.js:285-302, ported exactly into `attendance/math.ts`); effective availability (focus past `focusUntil` → open); board-post expiry; the cross-branch flag (≥2 member branches); challenge winners (PROTO student.html:412-416); a day's schedule + clashes (§9.3); branch/year label (from `homeClassId` → class → active term).

---

## 8. API
**Conventions:** base `/api/v1` · JSON camelCase · timestamps ISO-8601 UTC, dates `YYYY-MM-DD` · errors `{ "error": { "code": "FORBIDDEN", "message": "…" } }` with 400/401/403/404/409/422/429 · lists `?cursor=&limit=` → `{ items, nextCursor }` · uploads `POST /files/presign {name,type}` → `{ uploadUrl, key }`, then send `key` · header `X-Device-Id` (a client-generated uuid) on every request · server-computed display values (e.g. `attendance.text`) so clients stay thin.

| Module | Base path | Guard | Task |
|---|---|---|---|
| auth | `/auth` (login, logout, me, invite accept, forgot/reset) | public / auth | FND-04, FND-05 |
| files | `/files/presign` | auth | FND-06 |
| staff | `/staff` (directory: id, name, dept) | auth (not Commons) | CS-03 |
| classes | `/classes`, `/classes/:id/{members,invites,cr,terms,subjects,timetable,schedule,changes,board,imports,history,attendance}` | classAccess | CS-01…CS-07, CS-09 |
| posts | `/posts`, `/classes/:id/posts` | classAccess | CS-08 |
| attendance | `/attendance-sessions`, `/checkin`, `/me/attendance` | teach / auth | CS-09, CS-10 |
| me | `/me/{today,upcoming,reminders,notifications,profile}` | auth | CS-11, CS-12 |
| commons | `/commons/{people,profiles,board-posts,projects,challenges,conversations,blocks,reports,card}` | **commons()** | CM-01…CM-08 |
| tickets | `/tickets` | auth | AD-05 |
| admin | `/admin/{overview,users,staff-invites,students,institution,branches,classes,inbox,reports,moderation,conversations,featured,audit}` | admin() | AD-01…AD-08 |

Exact endpoints live in each task file, and the generated OpenAPI is the final contract.

---

## 9. Key flows
**9.1 Onboarding.** The admin invites a teacher (D3) → email → set password. The teacher creates a class (branch, admission year, section, min %; Term 1 is created) → pastes `ID, email` rows → **dry-run preview** (duplicate or bad email flagged, PROTO teacher.html:150-176) → invites sent → picks the CR. A student opens the link → ID and email are read-only → sets a password → 3 questions (availability, ≤5 skills, links; PROTO index.html:123-201) → Today.

**9.2 Promotion (D5).** `POST /classes/:id/terms/next` (class teacher or admin, confirm dialog): close the active term (`endedAt`), create term `semester+1`, `yearOfStudy=ceil(sem/2)`. Subjects, timetable and term-scoped board items stay with the old term (read-only, viewable via a term switcher). Notices and files persist. Members carry over. After semester 8, the next action is `POST /classes/:id/graduate` → `archivedAt`.

**9.3 Schedule and clashes (D10, D11).** `schedule(classId, date)` = active-term slots where `weekday = dow(date)`, minus slots with a `cancelled`/`moved` change on that date, plus `extra`/`event` changes on that date, plus `moved` changes whose `movedToDate = date`. Each item: `{kind, subject?, title?, teacher?, start, end, room, changed?, clashWith[]}`. **Clash** = intervals overlap (`a.start < b.end && b.start < a.end`) within the class, or the same teacher across classes. On a write that creates a clash, notify each involved teacher ("Two classes overlap at 13:00 in CSE · 2nd year · A, who's taking it?") with links to cancel/postpone. Teacher Today = the union of `schedule()` across their subjects. Pure maths goes in `schedule/math.ts` with unit tests.

**9.4 Import (D8).** `GET …/imports/prompts` → the CR copies the prompt for a kind into any chatbot with their file → pastes the JSON → `POST …/imports/preview` zod-validates it (timetable: subjects with teacher names + slots; syllabus: subject → units; datesheet: exams with dates), normalises times/weekdays and matches teacher names to staff (case-insensitive, titles stripped, best match + confidence) → an editable preview table → `POST …/imports/apply` writes the rows in one transaction, audited. Stateless: nothing is stored before apply. Bad JSON → 422 with readable errors; manual entry still works.

**9.5 Attendance.** Roll: everyone is present by default; the save body is `{absentIds[]}` and it upserts every row. Code: `POST /attendance-sessions/:id/code` opens a 2-min window. Code = `HMAC(codeSecret, floor(t/20s)) mod 10000`, and the current or previous window is accepted. A student check-in records `deviceId`. **One device for two accounts → both `flagged`, never rejected.** The teacher's save is final. A past session is allowed for today or yesterday (paper days). Corrections → AuditLog before/after. The CR gets **403**.

---

## 10. Web app
- **One SPA**, three areas by role: `/s/*` student (body class `student`), `/t/*` teacher (`teacher`), `/a/*` admin (`teacher` palette). `/` landing, `/login`, `/invite/:token`. After login: student → `/s`, staff → `/t` (admins see an "Admin" link in the rail), chief with no classes → `/a`.
- The **admin reuses screens**: `/a/classes/:id` renders the teacher class view with admin powers; `/a/commons` renders the student Commons components in moderation mode.
- Hash routes in the prototype become real routes (`/s/class/board`, `/t/class/:id/students`…).
- Data via TanStack Query hooks per module. A mutation invalidates the related keys and shows a toast (PROTO copy).
- PWA: manifest + precached app shell. Offline attendance queue is deferred (§15).
- **Visual rule:** screens copy the PROTO markup structure and class names. No new visual language (DESIGN.md).

---

## 11. Notifications and jobs
- `notify(userId, type, payload)` writes the in-app inbox. Students may mute types except `class-change`.
- Event → recipients follow SPEC §11, plus: `subject-allotted` (teacher, with "Not me"), `clash` (both teachers), `ticket-reply`.
- `jobs.ts` (node-cron, institution tz): 07:00 daily exam/deadline 3-day and 1-day reminders; daily board-post "expires in 2 days" nudges; daily invite cleanup. Focus revert and expiry are computed on read, so they need no job.

---

## 12. Local development
```
cp .env.example .env
npm install
npm run db:start              # postgres:5432 in the foreground; keep this terminal open
npm run db:reset              # truncate + seed (PROTO data.js cast); fresh DB: run migrate deploy first
npm run dev                   # server :3000 (tsx watch) + web :5173 (proxy /api → :3000)
npm test
```
Seed logins (demo password `campus123`): chief admin `academics@demo.edu`, teacher `meera.iyer@demo.edu`, CR student Riya Patel, plus the rest of the PROTO cast.

---

## 13. Production
- **One Node process**: `npm ci && npm run build`, then `npm start` (= `prisma migrate deploy && node dist/index.js`), serving `/api/v1` and `web/dist`. No Dockerfile (D14); add one only if a host demands it.
- **Switching from local = env vars only**: `DATABASE_URL` (Neon/Supabase/RDS), `S3_*` (S3/R2), `SMTP_*` (Resend/SES), `APP_URL`, `COOKIE_SECURE=true`.
- Any Node host (Render, Railway, Fly, a VPS with Node 24 + systemd). HTTPS terminated by the host. Daily DB backups by the provider.
- Details: `docs/DEPLOY-CHECKLIST.md` now (D16); the full `docs/DEPLOY.md` is task OPS-04, later.

---

## 14. Flutter readiness
Bearer auth (`POST /auth/login {email,password,client:"app"}` → `{token,user}`), no cookie dependence, versioned `/api/v1`, OpenAPI → `openapi-generator -g dart-dio`, presigned uploads, uniform pagination and errors, server-computed display values, a channel-agnostic `Notification` table (FCM can be added beside web push later).

---

## 15. Testing and deferred work
**Required tests** (QA-01 gates them): the wall (teacher → 403 on every `/commons/*`; admin → 200 + audit row); CR → 403 on attendance; a student can't read another's attendance; attendance maths (ported cases); promotion; schedule maths + clashes; check-in window + device flag; 5/day caps; the Focus gate (cold blocked, post-linked allowed); "Not me"; import JSON validation + teacher matching.

**Deferred** (not v1): GitHub commit sync, the LeetCode summary, web push (VAPID) + FCM, offline attendance queue (IndexedDB), iCal export, Hindi, branch-scoped admins (D13), alumni, escrow.
