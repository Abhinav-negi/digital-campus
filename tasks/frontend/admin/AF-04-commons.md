# AF-04 · Commons moderation + conversations + featured
**Reads:** ARCH §2 D2 · PROTO `admin.html:101-108` · API AD-06, AD-07, CM-* (read)
**Owns:** `web/src/routes/admin/commons/*`

## Do
- Tabs Board · Build · People · Conversations · Featured.
- Board/Build/People reuse the ST-07/08/09 components in `moderation` mode (an extra row of actions: Edit · Hide/Unhide · Delete · Ban author) and show hidden items with a "Hidden" badge.
- Conversations: search by user → list → read the thread (a banner "Reading is logged").
- Featured: the PROTO star list (3 max) + "Set as flagship".

**Visual rule:** copy the PROTO markup structure and class names; use DESIGN.md tokens only. Compare side by side with the prototype at 1280px and 390px before calling it done.

## Done when
- [ ] Hiding a reported post removes it from the student feed; reading a thread writes audit.

## Notes
