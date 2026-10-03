# TE-08 · Post composer + Upcoming + private reminders
**Reads:** SPEC §7.2, §7.4 · PROTO `teacher.html:427-463`, `:473-483`, `:540-544` · API CS-08, CS-11
**Owns:** `web/src/routes/teacher/{Composer,Upcoming}.tsx`

## Do
- The composer sheet (rail button, FAB, class header): Announcement | Assignment (due date), title, message, attachment (presign), **send to multiple classes** checkboxes, "Replies are off. Questions go to the class CR."
- Upcoming: 30 days grouped by week (This week / Next week / In n weeks), date blocks, kind badges, Today badge; "Add private reminder".

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] One post to 2 classes → "12 of 30 seen" appears as students open it (SPEC §15 step 4).

## Notes
