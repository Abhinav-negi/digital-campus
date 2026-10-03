import { config } from '../config.js';

// Calendar dates are `Date`s at UTC midnight (what Prisma reads/writes for `@db.Date`),
// so `dow`/`addDays` are plain UTC math and only `today` needs the institution timezone.

const DAY_MS = 86_400_000;

/** The institution's current calendar date, never the server clock's zone. */
export const today = (tz = config.INSTITUTION_TZ, now = new Date()) =>
  // en-CA formats as YYYY-MM-DD, which `new Date` parses as UTC midnight.
  new Date(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now));

/** ISO weekday: Monday = 1 … Sunday = 7 (TimetableSlot.weekday uses 1..6). */
export const dow = (date: Date) => date.getUTCDay() || 7;

export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
