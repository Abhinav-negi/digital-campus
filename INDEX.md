# Digital Campus: Task Index

> **Status lives only here.** ⬜ todo · 🟨 in progress · ✅ done (verified) · ⛔ blocked (say why in Notes of the task file)
> **Deps** must all be ✅ before a task starts. `FND` = all FND-* tasks.
> Update this file at the end of every task and every session (ORCHESTRATOR.md §3).

## Now
| | |
|---|---|
| **Latest handoff** | [handoff/S01-2026-10-03.md](handoff/S01-2026-10-03.md) |
| **Progress** | 1 / 78 done |
| **Ready to start** | OPS-02, FND-01, FS-01, DOC-01 |
| **Current wave** | Wave 1: Foundation |

## Waves (dispatch plan)
| Wave | Goal | Parallel lanes (one subagent each) |
|---|---|---|
| 1 Foundation | Repo, infra, schema, auth, web shell | lane A: OPS-01 → OPS-02 → FND-01 → FND-02 → FND-04 → FND-03/05/06/07 → FND-08 · lane B (after OPS-01): FS-01 → FS-02 → FS-03 → FS-04 → FS-08 · then FS-05 → FS-06 → FS-07 |
| 2 Backend | All API modules | lane CS (CS-01…12) · lane CM (CM-01…08) · lane AD (AD-01, 02, 04, 05, 08 first; AD-03/06/07 once their CS/CM deps land) |
| 3 Frontend | Every screen | lane ST (ST-01…10) · lane TE (TE-01…08) · lane AF (AF-01…05, after TE-05 / ST-09 for reuse) |
| 4 Ship | Gates and deploy | QA-01 → QA-04 · QA-02, QA-03 · OPS-03 → OPS-04 → QA-05 · OPS-05 · DOC-01 (any time) |

---

## Docs
| ID | Task | Deps | Status |
|---|---|---|---|
| [DOC-01](tasks/docs/DOC-01-spec-sync.md) | Sync Digital_Campus.md with the decisions | — | ⬜ |

## DevOps
| ID | Task | Deps | Status |
|---|---|---|---|
| [OPS-01](tasks/devops/OPS-01-monorepo.md) | Monorepo + workspaces + scripts | — | ✅ |
| [OPS-02](tasks/devops/OPS-02-docker-compose.md) | Docker Compose (Postgres, Mailpit, MinIO) + .env | OPS-01 | ⬜ |
| [OPS-03](tasks/devops/OPS-03-dockerfile.md) | Production image (API + PWA) | FND-01, FS-01 | ⬜ |
| [OPS-04](tasks/devops/OPS-04-deploy-guide.md) | Deploy guide | OPS-03 | ⬜ |
| [OPS-05](tasks/devops/OPS-05-ci.md) | CI pipeline | FND-08 | ⬜ |

## Backend: Foundation
| ID | Task | Deps | Status |
|---|---|---|---|
| [FND-01](tasks/backend/foundation/FND-01-server-skeleton.md) | Server skeleton + router registry (stubs) | OPS-01 | ⬜ |
| [FND-02](tasks/backend/foundation/FND-02-prisma-schema.md) | Full Prisma schema + migration (then frozen) | FND-01, OPS-02 | ⬜ |
| [FND-03](tasks/backend/foundation/FND-03-seed.md) | Seed: the prototype's demo world | FND-02, FND-04 | ⬜ |
| [FND-04](tasks/backend/foundation/FND-04-auth.md) | Auth: sessions, passwords, guards (the wall) | FND-02 | ⬜ |
| [FND-05](tasks/backend/foundation/FND-05-invites-mail.md) | Invites + email | FND-04 | ⬜ |
| [FND-06](tasks/backend/foundation/FND-06-shared-libs.md) | audit · notify · storage · dates · presign | FND-02 | ⬜ |
| [FND-07](tasks/backend/foundation/FND-07-openapi.md) | OpenAPI contract + type gen | FND-01 | ⬜ |
| [FND-08](tasks/backend/foundation/FND-08-test-harness.md) | Test harness | FND-03, FND-04 | ⬜ |

## Backend: Class space
| ID | Task | Deps | Status |
|---|---|---|---|
| [CS-01](tasks/backend/class-space/CS-01-classes-terms.md) | Classes, terms, promotion, graduate, handover | FND | ⬜ |
| [CS-02](tasks/backend/class-space/CS-02-members-cr.md) | Roster, student invites (dry-run), CR | CS-01 | ⬜ |
| [CS-03](tasks/backend/class-space/CS-03-subjects-allotment.md) | Staff directory + subjects + allotment + "Not me" | CS-01 | ⬜ |
| [CS-04](tasks/backend/class-space/CS-04-timetable.md) | Weekly timetable | CS-03 | ⬜ |
| [CS-05](tasks/backend/class-space/CS-05-schedule-clashes.md) | Per-date changes, events, clashes | CS-04 | ⬜ |
| [CS-06](tasks/backend/class-space/CS-06-document-import.md) | PDF/photo import via the Claude API | CS-03, CS-04, CS-07 | ⬜ |
| [CS-07](tasks/backend/class-space/CS-07-board-items.md) | Board items + edit history | CS-01 | ⬜ |
| [CS-08](tasks/backend/class-space/CS-08-posts.md) | Teacher posts, seen, remind | CS-01 | ⬜ |
| [CS-09](tasks/backend/class-space/CS-09-attendance-roll.md) | Attendance roll, past, corrections, views | CS-03 | ⬜ |
| [CS-10](tasks/backend/class-space/CS-10-attendance-code.md) | Attendance check-in code | CS-09 | ⬜ |
| [CS-11](tasks/backend/class-space/CS-11-today-upcoming.md) | Today, Upcoming, reminders | CS-05, CS-07, CS-08, CS-09 | ⬜ |
| [CS-12](tasks/backend/class-space/CS-12-notifications-jobs.md) | Notifications inbox + jobs | CS-01 | ⬜ |

## Backend: Commons
| ID | Task | Deps | Status |
|---|---|---|---|
| [CM-01](tasks/backend/commons/CM-01-profiles-people.md) | Profiles, People search, data export | FND | ⬜ |
| [CM-02](tasks/backend/commons/CM-02-board-posts.md) | Board posts, feed, caps, expiry | CM-01 | ⬜ |
| [CM-03](tasks/backend/commons/CM-03-board-actions-thanks.md) | Answers, interest/assign, claims, thanks | CM-02 | ⬜ |
| [CM-04](tasks/backend/commons/CM-04-projects.md) | Projects, join requests, updates | CM-01 | ⬜ |
| [CM-05](tasks/backend/commons/CM-05-challenges.md) | Challenges, submissions, likes | CM-01 | ⬜ |
| [CM-06](tasks/backend/commons/CM-06-conversations.md) | Message requests + conversations | CM-02 | ⬜ |
| [CM-07](tasks/backend/commons/CM-07-blocks-reports.md) | Block + report + auto-hide | CM-02, CM-04 | ⬜ |
| [CM-08](tasks/backend/commons/CM-08-commons-card.md) | "From the Commons" card | CM-03, CM-04 | ⬜ |

## Backend: Admin
| ID | Task | Deps | Status |
|---|---|---|---|
| [AD-01](tasks/backend/admin/AD-01-users-staff.md) | Users, staff invites, disable, reset, delete | FND | ⬜ |
| [AD-02](tasks/backend/admin/AD-02-admin-badge.md) | Admin badge grant/revoke | AD-01 | ⬜ |
| [AD-03](tasks/backend/admin/AD-03-student-details.md) | Edit student details, move batch | AD-01, CS-02 | ⬜ |
| [AD-04](tasks/backend/admin/AD-04-school.md) | Institution + branches | FND | ⬜ |
| [AD-05](tasks/backend/admin/AD-05-tickets-inbox.md) | Tickets + admin inbox | FND | ⬜ |
| [AD-06](tasks/backend/admin/AD-06-moderation.md) | Moderation, bans, conversation access | CM-06, CM-07 | ⬜ |
| [AD-07](tasks/backend/admin/AD-07-featured-flagship.md) | Featured + flagship | CM-04, CM-05 | ⬜ |
| [AD-08](tasks/backend/admin/AD-08-audit-overview.md) | Audit log + overview | AD-05 | ⬜ |

## Frontend: Shared
| ID | Task | Deps | Status |
|---|---|---|---|
| [FS-01](tasks/frontend/shared/FS-01-web-scaffold.md) | Web scaffold (Vite, router, Query, PWA) | OPS-01 | ⬜ |
| [FS-02](tasks/frontend/shared/FS-02-css-port.md) | Port the design-system CSS verbatim | FS-01 | ⬜ |
| [FS-03](tasks/frontend/shared/FS-03-ui-kit.md) | UI kit components | FS-02 | ⬜ |
| [FS-04](tasks/frontend/shared/FS-04-app-shell.md) | App shell (rail + bottom nav) | FS-03 | ⬜ |
| [FS-05](tasks/frontend/shared/FS-05-api-client.md) | API client + query hooks | FS-01, FND-07 | ⬜ |
| [FS-06](tasks/frontend/shared/FS-06-auth-pages.md) | Login, forgot/reset | FS-04, FS-05, FND-04 | ⬜ |
| [FS-07](tasks/frontend/shared/FS-07-invite-onboarding.md) | Invite → password → 3 questions | FS-06, FND-05 | ⬜ |
| [FS-08](tasks/frontend/shared/FS-08-landing.md) | Landing page | FS-02 | ⬜ |

## Frontend: Student
| ID | Task | Deps | Status |
|---|---|---|---|
| [ST-01](tasks/frontend/student/ST-01-today.md) | Today | FS-06, CS-11, CM-08 | ⬜ |
| [ST-02](tasks/frontend/student/ST-02-class-board.md) | Class: Board (read, empty states, terms) | FS-06, CS-05, CS-07 | ⬜ |
| [ST-03](tasks/frontend/student/ST-03-cr-edit.md) | CR edit: board, subjects + teacher picker, week grid | ST-02, CS-03, CS-04 | ⬜ |
| [ST-04](tasks/frontend/student/ST-04-week-ahead.md) | Week-ahead changes, events, clashes | ST-03, CS-05 | ⬜ |
| [ST-05](tasks/frontend/student/ST-05-import-preview.md) | Import PDF/photo → preview → confirm | ST-03, CS-06 | ⬜ |
| [ST-06](tasks/frontend/student/ST-06-posts-attendance.md) | Posts, my attendance, check-in | ST-02, CS-08, CS-10 | ⬜ |
| [ST-07](tasks/frontend/student/ST-07-commons-board.md) | Commons Board | FS-06, CM-02, CM-03, CM-06, CM-07 | ⬜ |
| [ST-08](tasks/frontend/student/ST-08-build.md) | Build: flagship, projects, challenges | ST-07, CM-04, CM-05 | ⬜ |
| [ST-09](tasks/frontend/student/ST-09-people.md) | People + person sheet + request | ST-07, CM-01, CM-06 | ⬜ |
| [ST-10](tasks/frontend/student/ST-10-me.md) | Me: profile, messages, notifications, tickets, data | ST-09, CS-12, AD-05 | ⬜ |

## Frontend: Teacher
| ID | Task | Deps | Status |
|---|---|---|---|
| [TE-01](tasks/frontend/teacher/TE-01-today.md) | Today: sessions, cancel/postpone, clashes, allotments | FS-06, CS-05, CS-11 | ⬜ |
| [TE-02](tasks/frontend/teacher/TE-02-attendance-roll.md) | Attendance: tap the absent | TE-01, CS-09 | ⬜ |
| [TE-03](tasks/frontend/teacher/TE-03-attendance-code.md) | Attendance: code mode | TE-02, CS-10 | ⬜ |
| [TE-04](tasks/frontend/teacher/TE-04-classes-list.md) | Classes list | FS-06, CS-01, CS-08 | ⬜ |
| [TE-05](tasks/frontend/teacher/TE-05-class-tabs.md) | Class: Board · Posts · Students · Attendance | TE-04, ST-03, CS-02 | ⬜ |
| [TE-06](tasks/frontend/teacher/TE-06-class-settings.md) | Settings: min %, next semester, graduate, hand over | TE-05 | ⬜ |
| [TE-07](tasks/frontend/teacher/TE-07-new-class.md) | New class wizard | TE-04, CS-02 | ⬜ |
| [TE-08](tasks/frontend/teacher/TE-08-composer-upcoming.md) | Composer + Upcoming + reminders | TE-04, CS-08, CS-11 | ⬜ |

## Frontend: Admin
| ID | Task | Deps | Status |
|---|---|---|---|
| [AF-01](tasks/frontend/admin/AF-01-shell-inbox.md) | Admin shell + Inbox | FS-06, AD-05, AD-06, AD-08 | ⬜ |
| [AF-02](tasks/frontend/admin/AF-02-people.md) | People: teachers, students, badge | AF-01, AD-01, AD-02, AD-03 | ⬜ |
| [AF-03](tasks/frontend/admin/AF-03-classes.md) | Classes (reuses the teacher view) | AF-01, TE-05 | ⬜ |
| [AF-04](tasks/frontend/admin/AF-04-commons.md) | Commons moderation, conversations, featured | AF-01, ST-09, AD-06, AD-07 | ⬜ |
| [AF-05](tasks/frontend/admin/AF-05-school-audit.md) | School setup + Audit | AF-01, AD-04, AD-08 | ⬜ |

## QA
| ID | Task | Deps | Status |
|---|---|---|---|
| [QA-01](tasks/qa/QA-01-permission-suite.md) | Permission suite (the wall) | all CS, CM, AD | ⬜ |
| [QA-02](tasks/qa/QA-02-lab-demo.md) | Lab-demo walk-through | all ST, TE, AF | ⬜ |
| [QA-03](tasks/qa/QA-03-visual-parity.md) | Visual parity with the prototype | all ST, TE, AF, FS-08 | ⬜ |
| [QA-04](tasks/qa/QA-04-review.md) | Code + security review | QA-01 | ⬜ |
| [QA-05](tasks/qa/QA-05-prod-smoke.md) | Production image smoke test | OPS-03, OPS-04 | ⬜ |

---

## Added tasks
*Findings and follow-ups discovered while building go here as new rows (next free ID in their region). Create the task file too.*
| ID | Task | Deps | Status | Origin |
|---|---|---|---|---|
