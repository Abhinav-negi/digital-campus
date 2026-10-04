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
