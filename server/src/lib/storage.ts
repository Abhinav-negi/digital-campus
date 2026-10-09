import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { config } from '../config.js';

// Same API for S3/R2 and local disk, so callers never branch (ARCH §5, D14).
// ponytail: local driver is a single-disk dev store; real S3/R2 in prod.

const EXPIRES_S = 15 * 60;
/** Repo-root `.data/uploads` (gitignored); same depth from src/lib and dist/lib. */
export const UPLOAD_DIR = resolve(import.meta.dirname, '../../../.data/uploads');
// No dedicated signing key in config: S3_SECRET_KEY, else per-process random (never a known constant,
// even if NODE_ENV is wrong). Links die on restart, which is fine for 15-minute URLs.
const secret = config.S3_SECRET_KEY || randomBytes(32);
const local = !config.S3_ENDPOINT;

const sign = (method: string, key: string, exp: number) =>
  createHmac('sha256', secret).update(`${method}\n${key}\n${exp}`).digest('base64url');

/** PUT signatures also cover the declared size (method `PUT:<size>`), so the limit can't be edited in the URL. */
const localUrl = (method: 'GET' | 'PUT', key: string, size?: number) => {
  const exp = Math.floor(Date.now() / 1000) + EXPIRES_S;
  const m = size === undefined ? method : `${method}:${size}`;
  return `${config.APP_URL}/api/v1/files/local/${encodeURI(key)}?exp=${exp}${size === undefined ? '' : `&size=${size}`}&sig=${sign(m, key, exp)}`;
};

// Single-use PUT links. ponytail: in-memory, per process (restart forgets; entries are tiny, 15 min links) — a table if multi-node.
const used = new Set<string>();
/** Claim a signature for one PUT; false if already claimed. Call `release` if the upload failed so the client can retry. */
export const claimSig = (sig: string) => (used.has(sig) ? false : (used.add(sig), true));
export const releaseSig = (sig: string) => void used.delete(sig);

const MAGIC: Record<string, (b: Buffer) => boolean> = {
  pdf: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  png: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  webp: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  zip: (b) => b.subarray(0, 2).toString('latin1') === 'PK',
  txt: (b) => !b.subarray(0, 512).includes(0), // plain text: no NUL bytes
};
/** True when the body's magic bytes match the key's extension (the presigned kind). Unknown extension → false. */
export const sniffOk = (key: string, body: Buffer) => MAGIC[key.split('.').pop() ?? '']?.(body) ?? false;

/** Local driver: true when `sig` is ours for (method, key, exp) and not expired. */
export const verifyLocal = (method: string, key: string, exp: unknown, sig: unknown) => {
  if (typeof exp !== 'string' || typeof sig !== 'string' || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  const want = Buffer.from(sign(method, key, Number(exp)));
  const got = Buffer.from(sig);
  return got.length === want.length && timingSafeEqual(got, want);
};

/** Absolute disk path for a key; throws if the key escapes UPLOAD_DIR. */
export const localPath = (key: string) => {
  const path = resolve(UPLOAD_DIR, key);
  if (!path.startsWith(UPLOAD_DIR + sep)) throw new Error(`Bad storage key: ${key}`);
  return path;
};

const s3 = (): never => {
  // Needs `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (ARCH §5); not installed yet.
  throw new Error('S3 driver not installed');
};

/** URL the client PUTs the raw file to (15 min). */
export const presignPut = async (key: string, _contentType: string, size: number) =>
  // ponytail: S3 needs createPresignedPost with content-length-range [1,size] + Content-Type condition (a presigned PUT can't bound size); see DEPLOY-CHECKLIST.
  local ? localUrl('PUT', key, size) : s3();

/** URL the client GETs the file from (15 min). */
export const presignGet = async (key: string) => (local ? localUrl('GET', key) : s3());

export const deleteObject = async (key: string) => (local ? rm(localPath(key), { force: true }) : s3());


/** True when `key` is one of `userId`'s own uploads from POST /files/presign (blocks attaching someone else's file, and `..`). */
export const ownKey = (userId: string, key: string) =>
  key.startsWith(`uploads/${userId}/`) && /^[\w-]+\.\w+$/.test(key.slice(`uploads/${userId}/`.length));
