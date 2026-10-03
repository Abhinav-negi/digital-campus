import type { ReactNode } from 'react';

export type BadgeKind = 'open' | 'questions' | 'focus' | 'danger' | 'warn' | 'clash';

/** Pill with a currentColor dot; `plain` hides the dot. `clash` defaults to the text "Clash". */
export function Badge({ kind, plain, children }: { kind: BadgeKind; plain?: boolean; children?: ReactNode }) {
  return <span className={`badge ${kind}${plain ? ' plain' : ''}`}>{children ?? (kind === 'clash' ? 'Clash' : null)}</span>;
}

/** A tag (span) or, with onClick, a filter toggle (button with aria-pressed). `tone` = the student-sheet extras. */
export function Chip({ on, tone, onClick, children }: { on?: boolean; tone?: 'due' | 'vio'; onClick?: () => void; children: ReactNode }) {
  const cls = ['chip', tone, on && 'on'].filter(Boolean).join(' ');
  return onClick
    ? <button type="button" className={cls} aria-pressed={!!on} onClick={onClick}>{children}</button>
    : <span className={cls}>{children}</span>;
}
