# AF-04a · Commons moderation (Board · Build · People)
**Reads:** ARCH §2 D2 · PROTO `admin.html:101-108` · API AD-06, CM-* (read)
**Owns:** `web/src/routes/admin/commons/{CommonsAdmin,Moderation}.tsx`

## Do
- Tabs Board · Build · People · Conversations · Featured.
- Board/Build/People reuse the ST-07/08/09 components in `moderation` mode (an extra row of actions: Edit · Hide/Unhide · Delete · Ban author), and show hidden items with a "Hidden" badge.

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. No screenshots here: QA-03 does one visual pass at the end.

## Done when
- [ ] Hiding a reported post removes it from the student feed.

## Notes
