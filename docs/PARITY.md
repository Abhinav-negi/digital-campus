# Visual parity (QA-03)

Method: headless Chrome, real login, app (Vite :5173, seeded DB) vs PROTO (`digital-campus-mvp/*.html`), 1280px and 390px.

## Screens checked
- Student (desktop + mobile): Today, Class board (desktop only visually; mobile overflow-checked), Posts, My attendance, Commons Board/Build/People, Me.
- Teacher (desktop + mobile): Today, Classes, Upcoming, class view (Board; Posts/Students/Attendance/Settings shot), attendance roll, New post composer (desktop).
- Admin (desktop; mobile overflow-checked): Inbox, People, Classes, Commons, School, Audit. PROTO admin has only Teachers/Reports/Featured, so the app admin is a rebuild (D-refs below), not a 1:1 comparison.
- Landing: shot, not diffed in detail.
- All 20 app routes at 390px: no horizontal scroll (scrollWidth == innerWidth).
- Not checked pixel-by-pixel: key sheets other than the teacher composer and CR tip sheet; mobile of Class/Commons/Me.

## Fixed (web/src)
| Difference | Fix |
|---|---|
| Commons / Class / admin Commons tab links were relative and resolved against the splat (`/s/commons/build/build`), so "Board" showed as active on Build and links broke | absolute `to` + `k === tab` highlight: `routes/student/commons/CommonsPage.tsx`, `routes/student/class/ClassPage.tsx`, `routes/admin/commons/CommonsAdmin.tsx` |
| `.week` 5 cols made the 14-day WeekAhead wrap | `.week.week-14` = 7 cols on desktop: `styles/style.css`, `student/class/edit/WeekAhead.tsx` |
| Teacher/admin class board timetable was unstyled (student.css is scoped to body.student) and `.slot` clashed with teacher.css session rows | shared `.week/.day/.slot/.ico/.chip.due` in `styles/style.css`, `.week .slot{display:block}` |
| Teacher/admin saw "as CR" and "Your CR will add..." | `staff` prop on `EditToggle`, `Board`, `CrWillAdd` (`ui/Empty.tsx`); passed from `teacher/class/BoardTab.tsx` |
| Student Today: linked cards rendered blue; Coming up lacked "in N days" chips and weekday date; post age "2d ago" | `a.card{color:inherit}`, chips + `lib/dates` fmt/rel in `student/Today.tsx` |
| Class board dates lacked weekday, chips capitalised ("In 3 days") | `student/class/Board.tsx` |
| Commons card byline: name not bold/stacked, branch label not a violet pill for other branches, count chip wrapped | `student/commons/BoardCard.tsx` |
| Me: section headings were h2 (too big), dates `09/10/2026`, "Helped 2" lacked "people", Mark all read not beside heading, duplicate "Need help?" heading | `student/me/MePage.tsx`, `Notifications.tsx`, `Messages.tsx` |
| Teacher Today: greeting used full name, eyebrow long date, no clock icon, Coming up lacked weekday date and "in N days" | `teacher/Today.tsx` |
| Teacher Upcoming "In 3 days" capitalised | `teacher/Upcoming.tsx` |

## Filed (for task rows)
1. **Post `UnreadPost` body preview** - student Today "New from teachers" shows title only; PROTO shows a 2-line body. Needs `body` on `UnreadPost` in the server today response (server + schema + web).
2. **Commons byline branch/year on Today card** - `c.byline` (commons card) has no branch/year label; PROTO shows "ME · 2nd year" pill. Add `label` to the byline object (server).
3. **Teacher Upcoming/Today: class name** - `UpcomingItem` has only `classId`; PROTO shows "CSE · 2nd year · A · Sun 11 Oct" and "Only you" for private reminders. Add `className`/`private` to UpcomingItem (server) and render.
4. **Board Files rows: age** - PROTO shows "15 days ago" under each file; `BoardItem` file rows lack `createdAt` use (check schema) - small server/web task.
5. **Edit history on Board** - PROTO lists 3 entries (relative time, "Riya Patel . Added exam"); app shows absolute time "7 Oct, 05:49". Switch to rel + actor-first layout in `student/class/edit/History.tsx` (web only, small).
6. **My projects on Me** - PROTO shows project cards (title, status, tags, avatars); app shows violet chips only. Reuse the Build project card in `MePage` (web, medium). Also PROTO profile header shows student ID ("25CSEA001").
7. **Teacher Today mobile: Take attendance button** - with the clash "..." menu the button no longer spans full width and the "..." floats; make `.act` full-width on <=720px (`SessionActions`, `teacher.css`).
8. **Sheet footers** - the teacher New post sheet at 900px tall hides Cancel/Post below the fold (sheet scrolls); consider a sticky footer in `ui/Sheet`.
9. **CR TipSheet shows on every visit?** - "Set up your class" opens for a CR whose class board is already filled; confirm trigger (should be empty-board only).
10. **Teacher/Admin Today order of "New from teachers"** - app lists newest first, PROTO oldest first (cosmetic, decide).

## Intentional (D-ref)
- Notification bell top bar on every role (D-notifications), `Log out` instead of "Reset demo data / Home / Student..." links (real auth).
- Clash badges and "Both teachers have been asked" / Keep mine rows on Today (D11), "..." menus on sessions.
- CR "Set up your class" sheet, Import (PDF/photo), WeekAhead 14-day editor, Edit history with timestamps (D7/D8).
- "Need help?" card + tickets on Me, admin Inbox/People/Classes/School/Audit and the "Admins can see Commons activity" note (D6/D10; admin can moderate, so the PROTO banner "Admins can't see..." is gone).
- Commons subtitle "Every student here..." and the students-only privacy line (ARCH students-only Commons).
- Teacher class Board: class teacher and admin get Edit (TE-05a); subject teachers see the read-only line as in PROTO.
- Sheet close (x) button, "Other branch" meaning kept as a violet pill (now carries the label).
