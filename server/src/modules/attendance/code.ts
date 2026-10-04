import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// CS-10: the rotating check-in code (ARCH §9.5, SPEC §8). Pure helpers; the routes live in routes.ts.

export const STEP_MS = 20_000; // the code changes every 20 seconds
export const WINDOW_MS = 120_000; // students have 2 minutes from "Use code"

export const newSecret = () => randomBytes(32).toString('hex');

/** The 20-second step `now` falls in, counted from when the code was opened (PROTO teacher.html tick). */
export const stepAt = (openedAt: Date, now: number) => Math.floor((now - openedAt.getTime()) / STEP_MS);

/** HMAC(codeSecret, step) mod 10000, as 4 digits. */
export const codeAt = (secret: string, step: number) =>
  String(createHmac('sha256', secret).update(String(step)).digest().readUInt32BE(0) % 10_000).padStart(4, '0');

/** Seconds until the code on screen changes. */
export const secondsLeft = (openedAt: Date, now: number) => Math.ceil((STEP_MS - ((now - openedAt.getTime()) % STEP_MS)) / 1000);

/** Inside the 2-minute window, and the teacher hasn't saved since opening it (their save is final). */
export const isOpen = (s: { codeSecret: string | null; codeOpenedAt: Date | null; savedAt: Date | null }, now: number): boolean => {
  if (!s.codeSecret || !s.codeOpenedAt) return false;
  const age = now - s.codeOpenedAt.getTime();
  return age >= 0 && age < WINDOW_MS && !(s.savedAt && s.savedAt >= s.codeOpenedAt);
};

/** The current or previous step's code matches `guess` (4 digits), compared in constant time. */
export const codeMatches = (secret: string, openedAt: Date, now: number, guess: string) => {
  const step = stepAt(openedAt, now);
  const hits = [step, step - 1].filter((n) => n >= 0).map((n) => timingSafeEqual(Buffer.from(codeAt(secret, n)), Buffer.from(guess)));
  return hits.includes(true);
};

// Wrong guesses per student, not per IP: a whole classroom shares one Wi-Fi address.
// ponytail: in-memory per process, like lib/auth rateLimit; move to Postgres/Redis if we ever run >1 instance.
export const MAX_FAILS = 5;
const FAIL_WINDOW_MS = 60_000;
const fails = new Map<string, { count: number; resetAt: number }>();

/**
 * Count a guess BEFORE any await, so parallel requests can't all pass the check (TOCTOU brute force).
 * False once the student is over MAX_FAILS in the window; a correct code gives the attempt back.
 */
export const takeGuess = (userId: string, now: number) => {
  let f = fails.get(userId);
  if (!f || f.resetAt <= now) fails.set(userId, (f = { count: 0, resetAt: now + FAIL_WINDOW_MS }));
  return ++f.count <= MAX_FAILS;
};

export const refundGuess = (userId: string) => {
  const f = fails.get(userId);
  if (f && f.count > 0) f.count--;
};
