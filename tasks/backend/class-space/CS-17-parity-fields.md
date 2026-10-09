# CS-17 · Server fields the prototype shows (parity)
**Reads:** docs/PARITY.md "Filed" 1–4 · API CS-11 (today/upcoming), CM-08 (commons card), CS-07 (board)
**Owns:** the today/upcoming/board/commons-card response builders + zod schemas in `server/src/modules/{class-space,commons}`, their tests; `web/src/api/schema.d.ts` (gen); the render lines in `web/src/routes/student/Today.tsx`, `web/src/routes/teacher/{Today,Upcoming}.tsx`, `web/src/routes/student/class/Board.tsx`

## Do
1. `UnreadPost.body` (first ~200 chars) → student Today shows a 2-line preview.
2. Commons card byline gets `label` ("ME · 2nd year") → pill on Today's commons card.
3. `UpcomingItem.className` + `private` → teacher Upcoming/Today rows show class name and "Only you".
4. Board file rows: `createdAt` → "15 days ago" under each file.
Additive fields only; `npm run gen:api`.

## Done when
- [ ] Each field present in the API (test) and rendered; server + web tests, typecheck, build green.

## Notes
