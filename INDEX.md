# Digital Campus: Task Index

> **Status lives only here.** ⬜ todo · 🟨 in progress · ✅ done (verified) · ⛔ blocked (say why in Notes of the task file)
> **Deps** must all be ✅ before a task starts. `FND` = all FND-* tasks. A dep on a split task (`ST-03`) means all its parts (ST-03a/b/c).
> Update this file at the end of every task and every session (ORCHESTRATOR.md §3).

## Now
| | |
|---|---|
| **Latest handoff** | [handoff/S10-2026-10-08.md](handoff/S10-2026-10-08.md) |
| **Progress** | **79%** · 70 / 89 done (project-ready) · 4 deployment tasks parked |
| **Ready to start** | ST-03c · CS-14 · CM-09 · CS-16 · AF-02 · AF-05 · ST-08c |
| **Current wave** | Wave 3: Frontend (Waves 1–2 ✅) |

## Waves (dispatch plan)
| Wave | Goal | Parallel lanes (one subagent each) |
|---|---|---|
| 1 Foundation | Repo, infra, schema, auth, web shell | lane A: OPS-01 → OPS-02 → FND-01 → FND-02 → FND-04 → FND-03/05/06/07 → FND-08 · lane B (after OPS-01): FS-01 → FS-02 → FS-03 → FS-04 → FS-08 · then FS-05 → FS-06 → FS-07 |
| 2 Backend | All API modules | lane CS (CS-01…12) · lane CM (CM-01…08) · lane AD (AD-01, 02, 04, 05, 08 first; AD-03/06/07 once their CS/CM deps land) |
| 3 Frontend | Every screen | lane ST (ST-01…10b) · lane TE (TE-01a…08) · lane AF (AF-01…05, after TE-05 / ST-09 for reuse). One task per subagent |
| 4 Project QA | Gates for the college demo | QA-01 → QA-04 · QA-02, QA-03 |
| Later | Deployment (D16) | OPS-03 → OPS-04 → QA-05 · OPS-05: only when the user asks |

---

## Docs
| ID | Task | Deps | Status |
|---|---|---|---|
| [DOC-01](tasks/docs/DOC-01-spec-sync.md) | Sync Digital_Campus.md with the decisions | — | ✅ |

## DevOps
| ID | Task | Deps | Status |
|---|---|---|---|
| [OPS-01](tasks/devops/OPS-01-monorepo.md) | Monorepo + workspaces + scripts | — | ✅ |
| [OPS-02](tasks/devops/OPS-02-local-services.md) | Local services without Docker (`db:start`) + .env | OPS-01 | ✅ |

## Backend: Foundation
| ID | Task | Deps | Status |
|---|---|---|---|
| [FND-01](tasks/backend/foundation/FND-01-server-skeleton.md) | Server skeleton + router registry (stubs) | OPS-01 | ✅ |
| [FND-02](tasks/backend/foundation/FND-02-prisma-schema.md) | Full Prisma schema + migration (then frozen) | FND-01, OPS-02 | ✅ |
| [FND-03](tasks/backend/foundation/FND-03-seed.md) | Seed: the prototype's demo world | FND-02, FND-04 | ✅ |
| [FND-04](tasks/backend/foundation/FND-04-auth.md) | Auth: sessions, passwords, guards (the wall) | FND-02 | ✅ |
| [FND-05](tasks/backend/foundation/FND-05-invites-mail.md) | Invites + email | FND-04 | ✅ |
| [FND-06](tasks/backend/foundation/FND-06-shared-libs.md) | audit · notify · storage · dates · presign | FND-02 | ✅ |
| [FND-07](tasks/backend/foundation/FND-07-openapi.md) | OpenAPI contract + type gen | FND-01 | ✅ |
| [FND-08](tasks/backend/foundation/FND-08-test-harness.md) | Test harness | FND-03, FND-04 | ✅ |

## Backend: Class space
| ID | Task | Deps | Status |
|---|---|---|---|
| [CS-01](tasks/backend/class-space/CS-01-classes-terms.md) | Classes, terms, promotion, graduate, handover | FND | ✅ |
| [CS-02](tasks/backend/class-space/CS-02-members-cr.md) | Roster, student invites (dry-run), CR | CS-01 | ✅ |
| [CS-03](tasks/backend/class-space/CS-03-subjects-allotment.md) | Staff directory + subjects + allotment + "Not me" | CS-01 | ✅ |
| [CS-04](tasks/backend/class-space/CS-04-timetable.md) | Weekly timetable | CS-03 | ✅ |
| [CS-05](tasks/backend/class-space/CS-05-schedule-clashes.md) | Per-date changes, events, clashes | CS-04 | ✅ |
| [CS-06](tasks/backend/class-space/CS-06-chatbot-import.md) | Import via any chatbot: prompt → pasted JSON → preview → apply | CS-03, CS-04, CS-07 | ✅ |
| [CS-07](tasks/backend/class-space/CS-07-board-items.md) | Board items + edit history | CS-01 | ✅ |
| [CS-08](tasks/backend/class-space/CS-08-posts.md) | Teacher posts, seen, remind | CS-01 | ✅ |
| [CS-09](tasks/backend/class-space/CS-09-attendance-roll.md) | Attendance roll, past, corrections, views | CS-03 | ✅ |
| [CS-10](tasks/backend/class-space/CS-10-attendance-code.md) | Attendance check-in code | CS-09 | ✅ |
| [CS-11](tasks/backend/class-space/CS-11-today-upcoming.md) | Today, Upcoming, reminders | CS-05, CS-07, CS-08, CS-09 | ✅ |
| [CS-12](tasks/backend/class-space/CS-12-notifications-jobs.md) | Notifications inbox + jobs | CS-01 | ✅ |

## Backend: Commons
| ID | Task | Deps | Status |
|---|---|---|---|
| [CM-01](tasks/backend/commons/CM-01-profiles-people.md) | Profiles, People search, data export | FND | ✅ |
| [CM-02](tasks/backend/commons/CM-02-board-posts.md) | Board posts, feed, caps, expiry | CM-01 | ✅ |
| [CM-03](tasks/backend/commons/CM-03-board-actions-thanks.md) | Answers, interest/assign, claims, thanks | CM-02 | ✅ |
| [CM-04](tasks/backend/commons/CM-04-projects.md) | Projects, join requests, updates | CM-01 | ✅ |
| [CM-05](tasks/backend/commons/CM-05-challenges.md) | Challenges, submissions, likes | CM-01 | ✅ |
| [CM-06](tasks/backend/commons/CM-06-conversations.md) | Message requests + conversations | CM-02 | ✅ |
| [CM-07](tasks/backend/commons/CM-07-blocks-reports.md) | Block + report + auto-hide | CM-02, CM-04 | ✅ |
| [CM-08](tasks/backend/commons/CM-08-commons-card.md) | "From the Commons" card | CM-03, CM-04 | ✅ |

## Backend: Admin
| ID | Task | Deps | Status |
|---|---|---|---|
| [AD-01](tasks/backend/admin/AD-01-users-staff.md) | Users, staff invites, disable, reset, delete | FND | ✅ |
| [AD-02](tasks/backend/admin/AD-02-admin-badge.md) | Admin badge grant/revoke | AD-01 | ✅ |
| [AD-03](tasks/backend/admin/AD-03-student-details.md) | Edit student details, move batch | AD-01, CS-02 | ✅ |
| [AD-04](tasks/backend/admin/AD-04-school.md) | Institution + branches | FND | ✅ |
| [AD-05](tasks/backend/admin/AD-05-tickets-inbox.md) | Tickets + admin inbox | FND | ✅ |
| [AD-06](tasks/backend/admin/AD-06-moderation.md) | Moderation, bans, conversation access | CM-06, CM-07 | ✅ |
| [AD-07](tasks/backend/admin/AD-07-featured-flagship.md) | Featured + flagship | CM-04, CM-05 | ✅ |
| [AD-08](tasks/backend/admin/AD-08-audit-overview.md) | Audit log + overview | AD-05 | ✅ |

## Deployment (later, D16)
*Parked: not dispatched until the user asks. The one-page list is [docs/DEPLOY-CHECKLIST.md](docs/DEPLOY-CHECKLIST.md).*
| ID | Task | Deps | Status |
|---|---|---|---|
| [OPS-03](tasks/devops/OPS-03-prod-build.md) | Production build (API + PWA, one Node process) | FND-01, FS-01 | ⬜ |
| [OPS-04](tasks/devops/OPS-04-deploy-guide.md) | Deploy guide | OPS-03 | ⬜ |
| [OPS-05](tasks/devops/OPS-05-ci.md) | CI pipeline | FND-08 | ⬜ |
| [QA-05](tasks/qa/QA-05-prod-smoke.md) | Production build smoke test | OPS-03, OPS-04 | ⬜ |

## Frontend: Shared
| ID | Task | Deps | Status |
|---|---|---|---|
| [FS-01](tasks/frontend/shared/FS-01-web-scaffold.md) | Web scaffold (Vite, router, Query, PWA) | OPS-01 | ✅ |
| [FS-02](tasks/frontend/shared/FS-02-css-port.md) | Port the design-system CSS verbatim | FS-01 | ✅ |
| [FS-03](tasks/frontend/shared/FS-03-ui-kit.md) | UI kit components | FS-02 | ✅ |
| [FS-04](tasks/frontend/shared/FS-04-app-shell.md) | App shell (rail + bottom nav) | FS-03 | ✅ |
| [FS-05](tasks/frontend/shared/FS-05-api-client.md) | API client + query hooks | FS-01, FND-07 | ✅ |
| [FS-06](tasks/frontend/shared/FS-06-auth-pages.md) | Login, forgot/reset | FS-04, FS-05, FND-04 | ✅ |
| [FS-07](tasks/frontend/shared/FS-07-invite-onboarding.md) | Invite → password → 3 questions | FS-06, FND-05, CM-01 | ✅ |
| [FS-08](tasks/frontend/shared/FS-08-landing.md) | Landing page | FS-02 | ✅ |
| [FS-09](tasks/frontend/shared/FS-09-area-layouts.md) | Student + teacher area layouts (route tables) | FS-04 | ✅ |

## Frontend: Student
| ID | Task | Deps | Status |
|---|---|---|---|
| [ST-01](tasks/frontend/student/ST-01-today.md) | Today | FS-06, CS-11, CM-08 | ✅ |
| [ST-02](tasks/frontend/student/ST-02-class-board.md) | Class: Board (read, empty states, terms) | FS-06, CS-05, CS-07 | ✅ |
| [ST-03a](tasks/frontend/student/ST-03a-board-edit.md) | CR edit: toggle, board forms, history, tip sheet | ST-02, CS-07 | ✅ |
| [ST-03b](tasks/frontend/student/ST-03b-subjects.md) | CR edit: subjects + teacher picker | ST-02, CS-03 | ✅ |
| [ST-03c](tasks/frontend/student/ST-03c-week-editor.md) | CR edit: weekly timetable editor | ST-03b, CS-04 | ⬜ |
| [ST-04](tasks/frontend/student/ST-04-week-ahead.md) | Week-ahead changes, events, clashes | ST-03, CS-05 | ⬜ |
| [ST-05](tasks/frontend/student/ST-05-import-preview.md) | Import: copy prompt → paste JSON → preview → confirm | ST-03, CS-06 | ⬜ |
| [ST-06](tasks/frontend/student/ST-06-posts-attendance.md) | Posts, my attendance, check-in | ST-02, CS-08, CS-10 | ✅ |
| [ST-07a](tasks/frontend/student/ST-07a-commons-feed.md) | Commons: header, feed, compose | FS-06, CM-02 | ✅ |
| [ST-07b](tasks/frontend/student/ST-07b-post-sheet.md) | Commons: post sheet actions + report | ST-07a, CM-03, CM-06, CM-07 | ✅ |
| [ST-08a](tasks/frontend/student/ST-08a-projects.md) | Build: flagship + projects | ST-07a, CM-04 | ✅ |
| [ST-08b](tasks/frontend/student/ST-08b-challenges.md) | Build: challenges | ST-08a, CM-05 | ✅ |
| [ST-09](tasks/frontend/student/ST-09-people.md) | People + person sheet + request | ST-07, CM-01, CM-06 | ✅ |
| [ST-10a](tasks/frontend/student/ST-10a-me-profile.md) | Me: profile + your data | ST-09 | ✅ |
| [ST-10b](tasks/frontend/student/ST-10b-me-inbox.md) | Me: messages, notifications, contact admin | ST-10a, CS-12, AD-05 | ✅ |

## Frontend: Teacher
| ID | Task | Deps | Status |
|---|---|---|---|
| [TE-01a](tasks/frontend/teacher/TE-01a-today.md) | Today: sessions + cancel/postpone | FS-06, CS-05, CS-11 | ✅ |
| [TE-01b](tasks/frontend/teacher/TE-01b-clash-allot.md) | Today: clash banner + allotment card | TE-01a, CS-12 | ✅ |
| [TE-02](tasks/frontend/teacher/TE-02-attendance-roll.md) | Attendance: tap the absent | TE-01, CS-09 | ✅ |
| [TE-03](tasks/frontend/teacher/TE-03-attendance-code.md) | Attendance: code mode | TE-02, CS-10 | ✅ |
| [TE-04](tasks/frontend/teacher/TE-04-classes-list.md) | Classes list | FS-06, CS-01, CS-08 | ✅ |
| [TE-05a](tasks/frontend/teacher/TE-05a-class-view.md) | Class: shell, Board, Posts | TE-04, ST-03 | ⬜ |
| [TE-05b](tasks/frontend/teacher/TE-05b-students-attendance.md) | Class: Students + Attendance tabs | TE-05a, CS-02 | ⬜ |
| [TE-06](tasks/frontend/teacher/TE-06-class-settings.md) | Settings: min %, next semester, graduate, hand over | TE-05 | ⬜ |
| [TE-07](tasks/frontend/teacher/TE-07-new-class.md) | New class wizard | TE-04, CS-02 | ✅ |
| [TE-08](tasks/frontend/teacher/TE-08-composer-upcoming.md) | Composer + Upcoming + reminders | TE-04, CS-08, CS-11 | ✅ |

## Frontend: Admin
| ID | Task | Deps | Status |
|---|---|---|---|
| [AF-01](tasks/frontend/admin/AF-01-shell-inbox.md) | Admin shell + Inbox | FS-06, AD-05, AD-06, AD-08 | ✅ |
| [AF-02](tasks/frontend/admin/AF-02-people.md) | People: teachers, students, badge | AF-01, AD-01, AD-02, AD-03 | ⬜ |
| [AF-03](tasks/frontend/admin/AF-03-classes.md) | Classes (reuses the teacher view) | AF-01, TE-05 | ⬜ |
| [AF-04a](tasks/frontend/admin/AF-04a-moderation.md) | Commons moderation (Board · Build · People) | AF-01, ST-09, AD-06 | ⬜ |
| [AF-04b](tasks/frontend/admin/AF-04b-conversations-featured.md) | Commons: conversations + featured | AF-04a, AD-07 | ⬜ |
| [AF-05](tasks/frontend/admin/AF-05-school-audit.md) | School setup + Audit | AF-01, AD-04, AD-08 | ⬜ |

## QA
| ID | Task | Deps | Status |
|---|---|---|---|
| [QA-01](tasks/qa/QA-01-permission-suite.md) | Permission suite (the wall) | all CS, CM, AD | ⬜ |
| [QA-02](tasks/qa/QA-02-lab-demo.md) | Lab-demo walk-through | all ST, TE, AF | ⬜ |
| [QA-03](tasks/qa/QA-03-visual-parity.md) | Visual parity with the prototype | all ST, TE, AF, FS-08 | ⬜ |
| [QA-04](tasks/qa/QA-04-review.md) | Code + security review | QA-01 | ⬜ |

---

## Added tasks
*Findings and follow-ups discovered while building go here as new rows (next free ID in their region). Create the task file too.*
| ID | Task | Deps | Status | Origin |
|---|---|---|---|---|
| [CS-13](tasks/backend/class-space/CS-13-card-fields.md) | ClassCard subjects/invited/attendance + change author isCr | CS-01, CS-11 | ✅ | TE-04, ST-01 (S08) |
| [CS-14](tasks/backend/class-space/CS-14-attendance-session-get.md) | GET one attendance session (reload-safe attendance page) | CS-09, TE-02 | 🟨 | TE-02 (S10) |
| [CS-15](tasks/backend/class-space/CS-15-checkin-open-flag.md) | `/me/today` codeOpen flag; CheckIn card only while a code is open | CS-13, ST-06 | ✅ | ST-06 (S10) |
| [CM-09](tasks/backend/commons/CM-09-board-mine-filter.md) | Board posts `mine` filter for Me | CM-02, ST-10a | ⬜ | ST-10a (S10) |
| [CS-16](tasks/backend/class-space/CS-16-notification-links.md) | Notification `link`s → real web routes | CS-12, ST-10b | ⬜ | ST-10b (S10) |
| [ST-08c](tasks/frontend/student/ST-08c-pick-winners.md) | Owner picks challenge winners | ST-08b, CM-05 | ⬜ | ST-08b (S11) |
