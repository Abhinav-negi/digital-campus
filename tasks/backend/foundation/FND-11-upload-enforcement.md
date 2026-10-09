# FND-11 · Enforce upload size/type on the bytes (review R4)
**Reads:** docs/REVIEW.md R4 · FND-06 (storage, presign)
**Owns:** `server/src/lib/storage*.ts` / presign, the local-disk upload handler, tests

## Do
- Local driver: reject a PUT whose body exceeds the presigned size or whose sniffed type doesn't match; a signature is single-use.
- S3 driver path (parked with D16): switch to `createPresignedPost` with `content-length-range` — note it in docs/DEPLOY-CHECKLIST.md.

## Done when
- [x] Test: presign pdf size 10 → PUT 1 KB HTML → 4xx; second PUT with the same URL → 4xx.

## Notes
- Local PUT signature now covers the declared size (`PUT:<size>`, `&size=` in URL); `presignPut(key, type, size)` takes size. Handler streams with a byte counter (413 over size, also on Content-Length), sniffs magic bytes vs key extension (pdf/png/jpg/webp/zip/txt; 415), and claims the sig single-use (409 on reuse; released if the upload fails so retry works).
- Used-sig set is in-memory per process (`ponytail:` in storage.ts); body is buffered only up to the signed size (<=15 MB).
- S3 stays parked: `ponytail:` comment on presignPut + DEPLOY-CHECKLIST line for `createPresignedPost`.
- Test: storage.test.ts "local PUT enforces..." (R4 repro). Server 180 pass, typecheck and web tests green.
- Not done (other SEC-04 parts): per-user presign rate limit, orphan sweep, R10 headers.
