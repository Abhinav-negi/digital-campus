# QA-02 · Lab-demo walk-through (SPEC §15) + the new flows
**Reads:** SPEC §15 · ARCH §2 D5–D11
**Owns:** `docs/DEMO.md` (the script + results)

## Do
Run the full script in the browser with the seed data and record a pass or fail per step:
1. A teacher creates a class, pastes 30 rows, an invite is accepted on a phone (link from the server log, or real SMTP) and a password set.
2. Make CR → the CR's phone shows Edit.
3. The CR imports a timetable PDF (or adds it by hand) and an exam → the student Today and the teacher Upcoming update; the allotted teacher sees the class.
4. One post to two classes → "12 of 30 seen" → Remind.
5. Tap 3 absent, save → a student's % changes. Code mode: 2 students on one device → flagged.
6. The CR moves a class to tomorrow and adds a 13:00 extra over a 13:00 slot → Clash on both; both teachers notified; one cancels → the clash clears.
7. Commons: Focus hides Ask; post a project, join, accept.
8. The wall: a teacher opening `/s/commons` → 403 page; the admin reads a conversation → audit row.
9. A student ticket → admin reply → visible in Me.
10. Start next semester → the name and year update; the old term is read-only.

## Done when
- [ ] Every step passes, or the failures are filed as tasks in INDEX.

## Notes
