# ST-11 · Past term is read-only in the UI
**Reads:** docs/DEMO.md F5 · ARCH §2 D5
**Owns:** `web/src/routes/student/class/{ClassPage,Board}.tsx`, `web/src/routes/student/class/edit/EditToggle.tsx`

## Do
- When the selected term is not the latest: hide the Edit toggle and every add/edit/delete control, show "Past term · read-only". Class-level notices follow the same rule (no edits from a past-term view).
- Confirm the server already refuses writes to a past term (409 PAST_TERM, see TE-06 Notes); if any board write isn't refused, report it as a CS task.

## Done when
- [ ] CR switches to a past term → no edit controls; a forced API write returns 409. Web checks green.

## Notes
- ClassPage: `past = termId !== latest` hides EditToggle (shows "Past term · read-only" chip) and forces `editing={... && !past}`; Board also gates add/delete on `editing && current`, so BoardTab (always `current`) is unchanged.
- Server: PATCH/DELETE on a past-term exam returned 409 PAST_TERM (curl, ie01 CR, class "IE · 2nd year · Demo"). POST /board has no termId; it always writes to the active term, so no past-term add exists to refuse.
- Live: Edit visible on Sem 3, absent on "Sem 1 (past)"; screenshots shots/st11-{current,past}.png.
- Checks: typecheck, web tests, web build green. Not added: a web test (no existing ClassPage test harness).
