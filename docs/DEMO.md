# Lab demo walk-through (QA-02)

Run date: 2026-10-09 (a Friday), seeded dev DB, `campus123` for every seeded account. Everything was driven through the real UI in headless Chrome (desktop 1280px for teachers/admin, 390px for "a phone"). The API and DB were used only to look things up and to confirm side effects (notification, audit and attendance rows). Where a step could not be finished in the UI, the workaround is stated and the step is marked accordingly.

Legend: PASS, PARTIAL (the point of the step works, one sub-part fails), FAIL.

## Script and results

| # | Step (SPEC §15 + new flows) | Result | Evidence |
|---|---|---|---|
| 1 | Teacher creates a class, pastes 30 rows, one invite is accepted on a phone, password set | PASS | Dr. Meera Iyer -> New class (IE, section "Demo") -> pasted 30 rows ("30 ready") -> picked a CR -> "Class created · 30 invites sent". Invite link taken from `api.log`; 390px phone: Join your class -> password -> Finish -> "You're in. Welcome to IE · 1st year · Demo". Done for 26IE001 and 26IE002. |
| 2 | Make CR -> the CR's phone shows Edit | PARTIAL | The CR (26IE001) set in the wizard sees "You are the CR" + Edit on the phone; a classmate (26IE002) sees neither. FAIL: the teacher cannot "tap a student -> Make CR" afterwards because the Students tab is a stub (F1). |
| 3 | CR imports a timetable and an exam -> student Today and teacher Upcoming update; allotted teacher sees the class | PASS | CR phone: Edit -> Import -> pasted chatbot JSON (4 subjects, 5 slots, 1 unmatched teacher "Prof. Nobody") -> preview "need a teacher" -> picked Prof. David Mathew -> Confirm -> "Timetable added · 5 classes · 4 teachers notified". Datesheet JSON -> "Datesheet added · 1 exams". Student 26IE002 Today: Engineering Physics 10:00 LH-1 Dr. Sana Khan + "Mid-term exam Wed 14 Oct". Sana: allotment card with "Not me", class in her Classes list, exam in Upcoming; David sees Workshop in Classes. |
| 4 | One post to two classes -> "12 of 30 seen" -> Remind | PASS | Meera posted "Demo: lab safety briefing" to CSE A and CSE B. 12 CSE-A students opened it on phones; Posts tab shows "12 of 28 seen" (28 = active students, the 2 invited are excluded, by design). Remind -> toast "Reminder sent to 34"; `Notification` rows type `post` created. |
| 5a | Tap 3 absent, save -> a student's % changes | PASS | CSE A, Data Structures 09:00: tapped 002/003/004 -> "25 present · 3 absent" -> "Attendance saved · students updated". Myra Reddy (absent) 83% -> 77%; Riya Patel (present) now 100%. |
| 5b | Code mode: 2 students on one device -> flagged | PARTIAL | Code mode never opens a code from the UI (F2). Workaround: opened the code with the same POST the page should make. Then 25cseb002 and 25cseb003 checked in from one phone context (log out, log in): teacher screen shows "Pooja and Kunal used the same device. Flagged, not rejected." and both tiles carry "Same device". |
| 6 | CR moves a class to tomorrow and adds a 13:00 extra over a 13:00 slot -> Clash on both; both teachers notified; one cancels -> clash clears | PARTIAL | CR phone: moved Fri Maths (Arjun) to Sat 10 Oct 13:00 over Data Structures (Meera) -> Clash badge on both items. Added an extra Workshop 13:00 on Fri 16 Oct over Maths -> Clash on both. `Notification` type `clash` rows for t1+t2 (Sat) and t4+t2 (16 Oct). To get a clash a teacher can act on, the CR added an extra Workshop 10:30 today over Sana's Physics 10:00: both Sana and David see "Overlaps with ... Who's taking it?"; Sana cancelled via the banner's "..." -> "Session cancelled · students notified"; David's banner went away and the CR's schedule shows Physics "Cancelled" with no Clash. FAIL part: for a clash on a future date (tomorrow) the teacher has no UI at all (F3). |
| 7 | Commons: Focus hides Ask; post a project, join, accept | PASS | 25csea005 on Open: other students see an "Ask" button on their card; on Focus: no "Ask". 25cseb004 created "Demo: campus bus tracker"; 25csea006 -> Ask to join; owner -> Accept; member then posted "Post update" (DB: 2 members, join request `accepted`, 1 `ProjectUpdate`). |
| 8 | The wall: a teacher at `/s/commons` -> 403 page; admin reads a conversation -> audit row | PARTIAL | Data wall holds: `GET /api/v1/commons/board` as a teacher -> 403 "The Commons is for students". But the UI silently redirects `/t` instead of showing a 403 page (F4). Admin (Office of Academics) -> Commons -> Conversations -> opened "Ananya Chopra and Riya Patel" -> `AuditLog` row `conversation.read` for `cv1`. |
| 9 | Student ticket -> admin reply -> visible in Me | PASS | 25csea007 Me -> Contact admin -> ticket sent; shows in admin Inbox; admin replied "Fixed, please check your card at the office."; student Me: status Answered, notification "Office of Academics replied to your ticket", and the thread shows "Admin: Fixed, ...". |
| 10 | Start next semester -> name and year update; old term is read-only | PARTIAL | Meera -> class -> Settings -> Start semester 2, then 3 (confirm dialogs): header changed "IE · 1st year · Demo" -> "IE · 2nd year · Demo", "SEMESTER 3". CR phone: term switcher shows "Year 2 · Sem 3 / Year 1 · Sem 2 (past) / Year 1 · Sem 1 (past)" and the Sem 1 timetable and exam are viewable. FAIL: the "Edit" controls (Add Notice/Exam/Deadline/File) are still offered while viewing a past term (F5). |

Other checks that passed along the way: an unmatched teacher in the import preview is flagged and the staff picker fixes it; login/redirects per role; the D9 empty states ("Your CR will add the timetable soon") appear before the CR adds anything.

## Failures

### F1. Class page: Students and Attendance tabs are "coming in TE-05b" stubs (step 2)
- Did: Meera -> Classes -> class -> Students tab (and the same via admin class detail).
- Happened: the text "Students - coming in TE-05b". No roster, no Make CR, Resend, Remove, Add students. The Attendance tab is the same.
- Expected: the roster with "Make CR" on each active student.
- Suggested task: "TE-05b: wire StudentsTab and AttendanceTab into ClassView". Likely file: `web/src/routes/teacher/class/ClassView.tsx` lines 43-44 (`soon(...)` is rendered although `StudentsTab` and `AttendanceTab` are already imported/built).

### F2. Attendance Code mode never opens a code (step 5b)
- Did: Today -> Take attendance -> Code tab.
- Happened: the code shows "----" and "No check-in code was opened for this session"; the page polls `GET .../code` (409) every 2 s and no `POST .../code` is ever sent.
- Expected: the code ring appears.
- Cause (likely): `CodeMode.tsx` tests `error?.error?.code === 'NO_CODE'`, but `api/client.ts` returns a flat `ApiError` (`error.code`), so the branch never fires. `AttendancePage.tsx` also polls `useCode` before a code exists.
- Suggested task: "Fix Code mode: open a code when GET /code returns NO_CODE". Files: `web/src/routes/teacher/attendance/CodeMode.tsx` (and a test using the real client error shape).

### F3. Teachers cannot see or act on notifications or on future-dated clashes (step 6)
- Did: after the CR moved a class to tomorrow (clash on Sat 10 Oct), Meera and Arjun looked for the "who's taking it?" prompt.
- Happened: the top bell does nothing (`onBell` is never passed to `AppShell`; clicking shows no panel, the count stays). The clash banner with Cancel/Postpone exists only on Today, so a clash tomorrow or later is invisible to the teacher and the cancel/postpone buttons from the notification are not reachable. (The `clash` Notification rows are created correctly in the DB.)
- Expected: both teachers get a "who's taking it?" message with Cancel/Postpone (D11).
- Suggested tasks: (a) "Notifications panel behind the bell (teacher and admin)", files `web/src/ui/AppShell.tsx`, `web/src/routes/teacher/index.tsx`; (b) "Let a teacher cancel or postpone their class on a future date (Upcoming schedule / clash notification actions)", files `web/src/routes/teacher/Upcoming.tsx`, `web/src/routes/teacher/SessionActions.tsx`.

### F4. Teacher at `/s/commons` gets redirected, not a 403 page (step 8)
- Did: logged in as Meera, opened `/s/commons`.
- Happened: silent redirect to `/t`. The API itself answers 403 FORBIDDEN, so the wall holds.
- Expected (SPEC §15 step 7): a visible 403 page.
- Suggested task: "Show a 403 page when a role opens another role's area". File: `web/src/router.tsx` (`guard` redirects to `homeOf(me)`). Or change the SPEC wording if the redirect is intended.

### F5. Past-term view still offers Edit (step 10)
- Did: CR phone -> Class -> term switcher "Year 1 · Sem 1 (past)" -> Edit.
- Happened: Edit mode turns on and Add Notice/Exam/Deadline/File appear (a notice was added successfully; notices are class-level so that one is fine, but Exam/Deadline/Syllabus are term-scoped; delete buttons also show). Not tried on an exam, so whether the server rejects it is unverified.
- Expected: the old term is read-only (D5).
- Suggested task: "Hide Edit and per-item editing when viewing a past term". File: `web/src/routes/student/class/ClassPage.tsx` line ~64 (`editing={isCr && editing}` is not gated by `termId === latest`) and the Edit toggle.

### F6. Students have no visible Log out on a phone (found in step 5b)
- Happened: in the 390px layout the only "Log out" link is in the hidden side rail; the Me page has none. In a lab with a shared phone nobody can switch accounts from the UI.
- Suggested task: "Add Log out to the student Me page". File: `web/src/routes/student/me/MePage.tsx` (logout handler is in `web/src/ui/AppShell.tsx`).

### F7. Login rate limit trips at about 10 logins per minute from one address (lab risk)
- Happened: logging in 12 students in a row returned "Too many attempts, try again in a minute" for the 1st and 12th attempt. In a lab all students share one NAT address, so a class logging in together would be blocked.
- Suggested task: "Key the login limiter on email + IP (or raise the IP limit)". Likely file: `server/src/modules/auth/` (rate-limit config) and `server/src/app.ts`.

### Minor polish (not blocking)
- Setup sheet on the CR page says "Import from a PDF or photo"; with D8 it is a copy-prompt/paste-JSON flow. File: `web/src/routes/student/class/` (setup sheet, Import.tsx).
- The "Set up your class" sheet re-opens on every visit to the CR page until a timetable exists; it blocks the Edit button.
- A CR without a profile name is shown as the student ID ("CR · 26IE001", "Good morning, 26IE001") because pasted rows have no names.
- Student Today "Up next" labels an extra class "· moved" (Workshop 10:30 extra).
- Import staff picker lists "Office of Academics" among the teacher chips.
- Admin/teacher Inbox badge numbers and "Fill a past session" appear on Today even on the first day; fine.

## Data left behind by this run (dev DB)
- Class "IE · 2nd year · Demo" (30 invited students ie01..ie30@students.demo.edu / 26IE001..030, two active with password `campus123`), now at semester 3.
- Post "Demo: lab safety briefing" (CSE A + B), project "Demo: campus bus tracker", ticket "Demo: wrong section on my ID card", attendance sessions for CSE A (saved) and CSE B (code opened, not saved), schedule changes on 9, 10 and 16 Oct for the IE class.
- Raghav Ali (25csea005) was switched Open -> Focus -> Open again.

## How to rerun
Log in per role at http://localhost:5173/login. Teacher: `meera.iyer@demo.edu` (CSE A/B teacher), `sana.khan@demo.edu`, `david.mathew@demo.edu`, `arjun.rao@demo.edu`. Admin: `academics@demo.edu`. Students: `25csea001@students.demo.edu` ... (CSE A, 001 is CR), `25cseb001` (CSE B CR). Dev invite links are in the API log. Use a fresh section name for the new class (a branch + year + section must be unique).

## Re-run (QA-02b)

Run date: 2026-10-09, reseeded dev DB, real UI in headless Chrome (1280px teachers/admin, 390px students), no S12 workarounds. The API/DB were used only to read invite links from `api.log` and the audit log (via the admin Audit page). New class "IE · 1st year · Demo" (30 rows). Every step passed; no new blocking failures.

| # | Step | Result | Evidence |
|---|---|---|---|
| 1 | Create class, paste 30 rows, accept an invite on a phone, set password | PASS | "30 ready" -> class created with 30 invites (30 mails in `api.log`); 390px: invite link -> Join your class -> password -> Finish -> "You're in. Welcome to IE · 1st year · Demo" for 26IE001 and 26IE002. |
| 2 | Make CR from the teacher's Students tab -> the CR's phone shows Edit | PASS | F1 fixed: Students tab lists the roster (Active/Invited, Resend, Remove). Meera tapped "Make CR" on 26IE002 -> row shows "CR"; on the phone 26IE002 sees "You are the CR" + Edit. |
| 3 | CR imports timetable + exam -> student Today, teacher Upcoming, allotted teacher | PASS | CR 26IE002 (made CR in step 2) pasted chatbot JSON: preview, picked a teacher for the unmatched name, Confirm -> 5 classes in the week; datesheet -> "Mid-term Wed 14 Oct". 26IE001 Today shows Physics 10:00 LH-1 and "Coming up: Mid-term"; Sana sees the allotment card with "Not me" and the class in her Classes; David sees the IE class (Workshop). |
| 4 | One post to two classes -> "12 of 30 seen" -> Remind | PASS | Meera posted to CSE A + B; 12 students opened it on phones; Posts tab "12 of 28 seen" (28 = active students, by design); Remind -> toast "Reminder sent to 34". |
| 5a | 3 absent, save -> a student's % changes | PASS | CSE A Data Structures 09:00: tapped 002/003/004 -> "25 present · 3 absent" -> "Attendance saved · students updated"; Myra (absent) now 77%, Riya (present) 100%. |
| 5b | Code mode from the UI: 2 students on one device -> flagged | PASS | F2 fixed: Code tab shows a rotating code (e.g. 7475, 20 s) with no manual POST. 25cseb002 and 25cseb003 checked in from one phone context -> "2 of 18 checked in" + "Pooja and Kunal used the same device. Flagged, not rejected." |
| 6 | CR moves a class to tomorrow + 13:00 extra over a 13:00 slot -> Clash both; both teachers notified; cancel clears | PASS | CR moved Fri Maths (Arjun) to Sat 10 Oct 13:00 over Data Structures (Meera) -> Clash badge on both items; extra Workshop 13:00 on 16 Oct over Maths -> Clash on both. Arjun's and Meera's bells (F3 fixed) show "Two classes overlap at 13:00 on 2026-10-10 ... who's taking it?"; clicking it opens `/t/upcoming?date=2026-10-10` with the clash banner. Meera: ⋯ -> Cancel this session -> Sat card "Cancelled"; Arjun's Upcoming no longer shows Clash on Sat 10 Oct. |
| 7 | Commons: Focus hides Ask; post a project, join, accept | PASS | 25csea005 on Open: other students see "Ask" on their card; on Focus: no "Ask". 25cseb004 created "Demo: campus bus tracker"; 25csea006 Ask to join; owner sheet showed Accept; after Accept the joiner sees "Post update". |
| 8 | Teacher at `/s/commons` -> 403 page; admin reads a conversation -> audit row | PASS | F4 fixed: Meera at `/s/commons` lands on `/403` ("403 · This area is not for your account · Go to your home"); direct API still 403. Admin opened "Ananya Chopra and Riya Patel" -> Audit page shows `conversation.read` for cv1. |
| 9 | Student ticket -> admin reply -> visible in Me | PASS | 25csea007 Contact admin -> ticket shown in admin Inbox; admin replied; student Me: status "Answered", thread shows "Admin: Fixed, please check your card at the office." |
| 10 | Start next semester -> name/year update; old term read-only | PASS | Meera Settings -> Start semester 2, 3: header "IE · 2nd year · Demo", SEMESTER 3. CR phone: term switcher "Year 2 · Sem 3 / Year 1 · Sem 2 (past) / Year 1 · Sem 1 (past)"; Sem 1 view shows "Past term · read-only", timetable and exam visible, and no Edit button (F5 fixed). |
| + | Student logs out from Me at 390px | PASS | 25csea008: Me -> Log out -> `/login`; `/s` then redirects back to `/login` (F6 fixed). |
| + | 12+ students log in from one machine in a row (D18) | PASS | 25csea002..013 logged in back to back (twice, 24 logins in about 1 minute) from one IP with no "Too many attempts" (F7 fixed). |

### Failures (re-run)
None blocking. Observations, all minor:
- Did: Teacher made the second student CR with "Make CR". Happened: both 26IE001 and 26IE002 are now CR (Make CR adds, the first CR is not demoted; the roster shows two "CR" rows). Expected: unclear (ARCHITECTURE allows several CRs?); no way to remove CR from the UI. Suggested task: "Add Remove CR / swap CR in StudentsTab if one CR is intended". File: `web/src/routes/teacher/class/StudentsTab.tsx`.
- Still open from the first run's minor list: the "Set up your class" sheet re-opens on every visit to the CR page until all steps are done and blocks the Edit button (needed dismiss/import click first); a CR without a profile name shows the student ID ("Good afternoon, 26IE001"). Setup sheet copy is now "Import with any chatbot" (fixed).

### Data left behind (dev DB)
Class "IE · 2nd year · Demo" (semester 3, 26IE001/002 active, password `campus123`, both CR), post "Demo: lab safety briefing", project "Demo: campus bus tracker", ticket "Demo: wrong section on my ID card", CSE A 09:00 attendance saved, CSE B code opened with two check-ins, schedule changes on 10 and 16 Oct (Sat Data Structures cancelled), Raghav Ali (25csea005) left on Focus.
