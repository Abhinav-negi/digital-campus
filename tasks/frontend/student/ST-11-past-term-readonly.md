# ST-11 · Past term is read-only in the UI
**Reads:** docs/DEMO.md F5 · ARCH §2 D5
**Owns:** `web/src/routes/student/class/{ClassPage,Board}.tsx`, `web/src/routes/student/class/edit/EditToggle.tsx`

## Do
- When the selected term is not the latest: hide the Edit toggle and every add/edit/delete control, show "Past term · read-only". Class-level notices follow the same rule (no edits from a past-term view).
- Confirm the server already refuses writes to a past term (409 PAST_TERM, see TE-06 Notes); if any board write isn't refused, report it as a CS task.

## Done when
- [ ] CR switches to a past term → no edit controls; a forced API write returns 409. Web checks green.

## Notes
