# AF-04a · Commons moderation (Board · Build · People)
**Reads:** ARCH §2 D2 · PROTO `admin.html:101-108` · API AD-06, CM-* (read)
**Owns:** `web/src/routes/admin/commons/{CommonsAdmin,Moderation}.tsx`

## Do
- Tabs Board · Build · People · Conversations · Featured.
- Board/Build/People reuse the ST-07/08/09 components in `moderation` mode (an extra row of actions: Edit · Hide/Unhide · Delete · Ban author), and show hidden items with a "Hidden" badge.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [x] Hiding a reported post removes it from the student feed.

## Notes
- Student cards got an optional `moderation`/`mod` prop (Board, BoardCard, BuildPage, ProjectCard, Challenges, People); `ModTarget`/`Moderation` types live in student/commons/BoardCard.tsx. Students unchanged.
- API gap: no direct hide (only POST /admin/reports/{id} action hide, so Hide needs an open report) and no admin listing of hidden items (feeds filter hiddenAt:null even for admins). Hidden items are indexed via Inbox reports state=hidden + GET detail (admins may read hidden); Unhide uses /admin/commons/{type}/{id}/unhide.
- Live: hid bp15 via rp3 -> student feed 1->0; admin feed also 0 (no hidden flag in any list); unhide -> back. rp3 restored to open. No data created.
- Conversations and Featured tabs: placeholder "Coming in AF-04b."

