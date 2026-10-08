import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { toast } from '../../../ui/Toast';
import { openedSessions, useSaveAttendance, useStaffToday } from '../queries';
import { Roster } from './Roster';

// PROTO teacher.html:204-254. ponytail: Roll only; the Code tab is TE-03 and stays disabled.
export function Component() {
  const { sessionId = '' } = useParams();
  const sess = openedSessions.get(sessionId);
  const go = useNavigate();
  const save = useSaveAttendance(sessionId);
  const slot = useStaffToday().data?.sessions.find((s) => sess?.slotId && s.slotId === sess.slotId);
  const [absent, setAbsent] = useState(() => new Set(sess?.absentIds ?? []));

  useEffect(() => {
    document.body.classList.add('attending');
    return () => document.body.classList.remove('attending');
  }, []);

  // Opened without going through Today / Past session (e.g. a reload): the API can't re-fetch a session by id.
  if (!sess) return <Navigate to="/t" replace />;

  const n = sess.roster.length;
  const toggle = (id: string) => setAbsent((a) => { const b = new Set(a); if (!b.delete(id)) b.add(id); return b; });
  const cnt = <div className="cnt"><b>{n - absent.size}</b> present · <b className={absent.size ? 'neg' : ''}>{absent.size}</b> absent</div>;
  const eyebrow = slot && !sess.savedAt ? `Tap the absent · ${slot.start}–${slot.end}${slot.room ? ` · ${slot.room}` : ''}`
    : `${sess.savedAt ? 'Correction' : 'Past session'} · ${new Date(sess.date + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;

  return (
    <>
      <button type="button" className="backlink" onClick={() => go('/t')}>← Today</button>
      <div className="page-head">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{sess.subject.name}</h1>
          <p className="muted">{sess.class.name} · {n} student{n === 1 ? '' : 's'}</p>
        </div>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected className="tab on">Roll</button>
          <button type="button" role="tab" aria-selected={false} className="tab" disabled title="Coming soon">Code</button>
        </div>
      </div>
      <div className="row between big-cnt" style={{ marginBottom: 'var(--s2)' }}>
        {cnt}<span className="small muted">Everyone is present. Tap the absent.</span>
      </div>
      <Roster roster={sess.roster} absent={absent} onToggle={toggle} />
      <div className="savebar">
        {cnt}
        <button type="button" className="btn primary" disabled={save.isPending}
          onClick={() => save.mutate([...absent], {
            onSuccess: () => { toast('Attendance saved · students updated'); go('/t'); },
            onError: (e) => toast(e.message),
          })}>Save attendance</button>
      </div>
    </>
  );
}
