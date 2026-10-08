# CM-09 · "Mine" filter for Commons board posts
**Reads:** API CM-02 · `server/src/modules/commons/` board-posts list route
**Owns:** the board-posts list route + its test; `web/src/routes/student/me/MePage.tsx` (My board posts section)

## Do
- `GET /commons/board-posts?mine=true` → only my posts, including expired/closed ones, newest first, paged as today.
- `npm run gen:api`; Me "My board posts" uses it instead of filtering the first 50 live posts by author.

## Done when
- [ ] Test: `mine=true` returns my expired post and none of anyone else's.

## Notes
- Origin: ST-10a (S10). Without it, Me misses older/expired posts.
- Added mine=true (feed query, 'true'|'false'); skips expiry filter, authorId=me. Test in board-posts.test.ts. Me page uses it.
- S11 orchestrator: full suite 171/171 after gen:api; MePage uses mine=true.
