# TE-01b · Teacher Today: clash banner + allotment card
**Reads:** ARCH §2 D7, D11 · API CS-05, CS-03 (decline), CS-12
**Owns:** `web/src/routes/teacher/{ClashBanner,AllotmentCard}.tsx`

## Do
- **Clash banner** on clashing sessions: "Overlaps with {other subject} by {teacher} in {class} at 13:00. Who's taking it?" → [Keep mine] (dismiss locally) · [Cancel mine] · [Postpone mine] (reuse TE-01a SessionActions).
- **Allotment card** for new `subject-allotted` notifications: "Riya (CR) added you as teacher of Data Structures in CSE · 2nd year · A" → [Got it] · [Not me].
- Mount both in TE-01a's Today (one import + one line each).

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] A seed clash shows the banner for both teachers; cancelling one clears it on refresh; Not me removes the class.

## Notes

- Done 2026-10-06. Files: ClashBanner.tsx, AllotmentCard.tsx (AllotmentCards), hooks useAllotments/useAllotmentReply in queries.ts, mounts in Today.tsx.
- Banner uses `clashWith[0]` (no teacher name in API: text omits "by {teacher}"). Cancel/Postpone are SessionActions' single "⋯" button, not two buttons (that file isn't owned here).
- Allotment card shows unread `subject-allotted` notifications (CS-12); Got it = POST /me/notifications/read; Not me = POST /classes/:id/subjects/:sid/decline (classId/subjectId from payload) then mark read.
- Seed clash is dated at seed time: reseed (`npm run db:seed -w server`) on a new day or /me/today shows none. Login is rate-limited (429) and needs an Origin header for POSTs.
- Verified with curl on :4101: clash for Meera + Sana, Sana cancel clears both, decline -> 204 and class gone. DB reseeded after.
