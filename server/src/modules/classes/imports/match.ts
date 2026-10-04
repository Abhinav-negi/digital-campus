// CS-06: pure normalisers + name matching for the chatbot import (D8). No DB here.

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** "9:00 am", "9.30pm", "14:00", "9 AM" → "HH:MM"; anything else → null. */
export const normTime = (raw: unknown) => {
  const m = /^(\d{1,2})(?:\s*[:.h]\s*(\d{2}))?\s*(?:([ap])\.?\s*m?\.?)?$/i.exec(String(raw ?? '').trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ap = m[3]?.toLowerCase();
  if (min > 59 || h > (ap ? 12 : 23) || (ap && h === 0)) return null;
  if (ap) h = (h % 12) + (ap === 'p' ? 12 : 0);
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

/** "Mon", "tuesday", 3, "3" → 1..6 (Mon..Sat); Sunday and junk → null. */
export const normWeekday = (raw: unknown) => {
  const s = String(raw ?? '').trim().toLowerCase();
  if (/^[1-6]$/.test(s)) return Number(s);
  const i = DAYS.indexOf(s.slice(0, 3));
  return /^[a-z]+\.?$/.test(s) && i >= 0 ? i + 1 : null;
};

const ymd = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? t.toISOString().slice(0, 10) : null;
};

/** "2026-11-05", "05/11/2026" (day first), "5 Nov 2026" → "YYYY-MM-DD"; else null. */
export const normDate = (raw: unknown) => {
  const s = String(raw ?? '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return ymd(+m[1]!, +m[2]!, +m[3]!);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return ymd(+m[3]!, +m[2]!, +m[1]!);
  if (/[a-z]/i.test(s) && !Number.isNaN(Date.parse(s))) {
    const d = new Date(s);
    return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  return null;
};

const TITLES = new Set(['dr', 'prof', 'professor', 'mr', 'mrs', 'ms', 'miss', 'sir', 'madam', 'shri', 'smt']);
const tokens = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !TITLES.has(t));

/** Dice overlap of the name tokens (titles stripped), 0..1. */
export const similarity = (a: string, b: string) => {
  const x = new Set(tokens(a));
  const y = new Set(tokens(b));
  if (!x.size || !y.size) return 0;
  return (2 * [...x].filter((t) => y.has(t)).length) / (x.size + y.size);
};

/** The best candidate scoring ≥ `min`, or null. */
export const bestMatch = <T extends { name: string }>(name: string, candidates: T[], min = 0.6) => {
  let best: T | null = null;
  let top = 0;
  for (const c of candidates) {
    const s = similarity(name, c.name);
    if (s > top) [best, top] = [c, s];
  }
  return top >= min ? best : null;
};
