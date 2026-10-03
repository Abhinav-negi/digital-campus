// Ports of PROTO data.js:323-324. Dates are 'YYYY-MM-DD' strings, read as local midnight.
const day = (d: string) => new Date(d + 'T00:00');
const pad = (n: number) => String(n).padStart(2, '0');
export const today = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

/** "Mon 12 Oct" */
export const fmt = (d: string) => day(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** "today" · "tomorrow" · "yesterday" · "in 3 days" · "3 days ago" */
export const rel = (d: string, from = today()) => {
  const n = Math.round((day(d).getTime() - day(from).getTime()) / 864e5);
  return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? `in ${n} days` : `${-n} days ago`;
};

export const greeting = (hour: number) => (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');
