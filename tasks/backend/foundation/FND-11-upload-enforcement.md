# FND-11 · Enforce upload size/type on the bytes (review R4)
**Reads:** docs/REVIEW.md R4 · FND-06 (storage, presign)
**Owns:** `server/src/lib/storage*.ts` / presign, the local-disk upload handler, tests

## Do
- Local driver: reject a PUT whose body exceeds the presigned size or whose sniffed type doesn't match; a signature is single-use.
- S3 driver path (parked with D16): switch to `createPresignedPost` with `content-length-range` — note it in docs/DEPLOY-CHECKLIST.md.

## Done when
- [ ] Test: presign pdf size 10 → PUT 1 KB HTML → 4xx; second PUT with the same URL → 4xx.

## Notes
