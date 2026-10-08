# TE-08 · Post composer + Upcoming + private reminders
**Reads:** SPEC §7.2, §7.4 · PROTO `teacher.html:427-463`, `:473-483`, `:540-544` · API CS-08, CS-11
**Owns:** `web/src/routes/teacher/{Composer,Upcoming}.tsx`

## Do
- The composer sheet (rail button, FAB, class header): Announcement | Assignment (due date), title, message, attachment (presign), **send to multiple classes** checkboxes, "Replies are off. Questions go to the class CR."
- Upcoming: 30 days grouped by week (This week / Next week / In n weeks), date blocks, kind badges, Today badge; "Add private reminder".

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] One post to 2 classes → "12 of 30 seen" appears as students open it (SPEC §15 step 4).

## Notes
- `Composer({classId?, onClose})` is exported for TE-05a's class header (pre-ticks that class); the rail button + FAB open it via the teacher layout (`index.tsx` got `fab` + a `composing` state).
- Not using `ui/FormSheet`: its `upload()` posts `{name,type}` to presign but the API wants `{name,contentType,size}` (shared bug, left alone). Attachment upload lives in `queries.ts` `uploadAttachment`.
- Class picker lists classes where `myRole` is classTeacher/teacher (API 403s otherwise). "Today" badge uses `warn` (Badge has no `gold`).
- "n of N seen" is shown by the class view / Classes list from `stats`; this task only creates the post. Not verified against a live server (typecheck + web tests only).

- S10 orchestrator: fixed the shared root cause in ui/FormSheet upload() (sent {name,type}, API wants {name,contentType,size} → 422; broke BoardForms/Compose file fields too); uploadAttachment now reuses it. Verified by curl: post to c1+c2 → stats 0/46 → student seen → 1/46; presign+PUT 200. Leaves a 'S10 verify' post in the dev DB (reseed clears).
