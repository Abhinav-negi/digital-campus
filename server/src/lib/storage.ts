import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { config } from '../config.js';

// Same API for S3/R2 and local disk, so callers never branch (ARCH §5, D14).
// ponytail: local driver is a single-disk dev store; real S3/R2 in prod.

const EXPIRES_S = 15 * 60;
/** Repo-root `.data/uploads` (gitignored); same depth from src/lib and dist/lib. */
export const UPLOAD_DIR = resolve(import.meta.dirname, '../../../.data/uploads');
// No dedicated signing key in config. Dev: a fixed constant so URLs survive `tsx watch` restarts.
// Prod without S3_SECRET_KEY: per-process random, so the public constant can never sign there.
const secret = config.S3_SECRET_KEY || (config.NODE_ENV === 'production' ? randomBytes(32) : 'dev-local-uploads');
const local = !config.S3_ENDPOINT;

const sign = (method: string, key: string, exp: number) =>
  createHmac('sha256', secret).update(`${method}\n${key}\n${exp}`).digest('base64url');

const localUrl = (method: 'GET' | 'PUT', key: string) => {
  const exp = Math.floor(Date.now() / 1000) + EXPIRES_S;
  return `${config.APP_URL}/api/v1/files/local/${encodeURI(key)}?exp=${exp}&sig=${sign(method, key, exp)}`;
};

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
export const presignPut = async (key: string, _contentType: string) => (local ? localUrl('PUT', key) : s3());

/** URL the client GETs the file from (15 min). */
export const presignGet = async (key: string) => (local ? localUrl('GET', key) : s3());

export const deleteObject = async (key: string) => (local ? rm(localPath(key), { force: true }) : s3());

