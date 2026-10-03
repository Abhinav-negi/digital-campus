import type { ReactNode } from 'react';

/** Attendance bar: safe = success, warn = accent, below = danger. */
export function Bar({ pct, status = 'safe' }: { pct: number; status?: 'safe' | 'warn' | 'danger' | 'below' }) {
  const cls = status === 'safe' ? 'bar' : `bar ${status === 'below' ? 'danger' : status}`;
  return (
    <div className={cls} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ num, lbl }: { num: ReactNode; lbl: ReactNode }) {
  return (
    <div className="stat">
      <div className="num">{num}</div>
      <div className="lbl">{lbl}</div>
    </div>
  );
}
