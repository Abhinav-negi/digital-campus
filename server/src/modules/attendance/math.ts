// CS-09: attendance maths, ported verbatim from PROTO data.js attendance(). Pure: no DB.

export type AttendanceStatus = 'safe' | 'warn' | 'danger';

/** `{pct, status, text}` for `present` of `total` sessions against a `min` % (0 sessions → 100%). */
export const attendanceSummary = (present: number, total: number, min: number) => {
  const pct = total ? Math.round((present / total) * 100) : 100;
  let status: AttendanceStatus, text: string;
  if (pct >= min) {
    const margin = Math.floor((present * 100) / min - total); // classes you can miss and stay at the minimum
    status = pct < min + 3 ? 'warn' : 'safe';
    text = margin > 0 ? `Safe by ${margin} class${margin > 1 ? 'es' : ''}` : 'Right at the line';
  } else {
    const need = Math.ceil((min * total - 100 * present) / (100 - min)); // consecutive classes to recover
    status = 'danger';
    text = `Attend the next ${need}`;
  }
  return { pct, status, text };
};
