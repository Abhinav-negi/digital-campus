import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { useCode, useOpenCode } from '../queries';
import type { AttendanceSession } from '../queries';

// PROTO teacher.html:224-229, 256-273. The code is always the server's; this only draws it.
export function CodeMode({ sessionId, roster }: { sessionId: string; roster: AttendanceSession['roster'] }) {
  const open = useOpenCode(sessionId);
  const { mutate } = open;
  const [ready, setReady] = useState(false);
  // Opening a code wipes this session's check-ins server-side, so only open one if none was ever opened.
  useEffect(() => {
    let off = false;
    api.GET('/attendance-sessions/{id}/code', { params: { path: { id: sessionId } } }).then(({ error }) => {
      if (off) return;
      if ((error as { error?: { code?: string } } | undefined)?.error?.code === 'NO_CODE') mutate(undefined, { onSuccess: () => setReady(true) });
      else setReady(true);
    });
    return () => { off = true; };
  }, [sessionId, mutate]);
  const q = useCode(sessionId, ready);
  const d = q.data;
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const rem = d?.code ? Math.max(0, Math.min(20, d.secondsLeft % 20 || d.secondsLeft) - (now - q.dataUpdatedAt) / 1000) : 0;
  const first = (id: string) => roster.find((s) => s.id === id)?.name.split(' ')[0] ?? '';
  const flagged = d?.flagged ?? [];
  const err = open.error ?? q.error;
  return (
    <div className="card tint" style={{ marginBottom: 'var(--s3)' }}>
      <div className="ring">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--surface)" strokeWidth="5" />
          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--secondary)" strokeWidth="5" strokeLinecap="round" strokeDasharray="283" strokeDashoffset={283 * (1 - rem / 20)} />
        </svg>
        <div className="mid"><div className="code">{d?.code ?? '----'}</div><div className="tiny muted">{d?.code ? `${Math.ceil(rem)}s` : ''}</div></div>
      </div>
      <p className="small muted" style={{ textAlign: 'center', marginTop: 'var(--s2)' }}>
        {err ? err.message : d && !d.code ? 'Check-in is closed. Tap anyone to correct.' : 'Students enter this code in their app. It changes every 20 seconds.'}
      </p>
      <p style={{ textAlign: 'center', marginTop: 'var(--s1)' }}><b>{d?.checkedIn.length ?? 0}</b> of {roster.length} checked in</p>
      {flagged.length > 1 && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 'var(--s2)' }}>
          <span className="badge warn" style={{ whiteSpace: 'normal' }}>
            {flagged.slice(0, 2).map(first).join(' and ')}{flagged.length > 2 ? ` +${flagged.length - 2}` : ''} used the same device. Flagged, not rejected.
          </span>
        </div>
      )}
    </div>
  );
}
