import { useState } from 'react';
import { SessionActions } from './SessionActions';
import type { ClashSession } from './queries';

const key = (id: string) => `clash-dismissed:${id}`;
const read = (id: string) => { try { return sessionStorage.getItem(key(id)) === '1'; } catch { return false; } };

// D11: clashes are information, never blocked. "Keep mine" hides the banner for this browser session.
// ponytail: SessionActions owns the Cancel/Postpone sheets and shows one "⋯" button; split into two buttons if it gains a variant prop.
export function ClashBanner({ s, date, mine }: { s: ClashSession; date: string; mine: boolean }) {
  const [gone, setGone] = useState(() => read(s.id));
  const o = s.clashWith[0];
  if (!o || gone || s.off || s.change?.kind === 'cancelled') return null;
  const keep = () => { try { sessionStorage.setItem(key(s.id), '1'); } catch { /* private mode: dismiss for this render only */ } setGone(true); };
  return (
    <div className="banner row between wrap" role="alert" style={{ marginTop: 'var(--s1)', gap: 'var(--s2)' }}>
      <span className="small">Overlaps with {o.name} in {o.className} at {o.start}{o.teacher && ` by ${o.teacher.name}`}. Who's taking it?</span>
      <span className="row" style={{ gap: 'var(--s1)' }}>
        <button type="button" className="btn sm" onClick={keep}>Keep mine</button>
        {mine && <SessionActions s={s} date={date} />}
      </span>
    </div>
  );
}
