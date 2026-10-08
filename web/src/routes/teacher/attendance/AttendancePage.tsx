import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { toast } from '../../../ui/Toast';
import { openedSessions, useCode, useSaveAttendance, useStaffToday } from '../queries';
import { CodeMode } from './CodeMode';
import { Roster } from './Roster';

// PROTO teacher.html:204-254. Roll tab + Code tab (TE-03).
export function Component() {
  const { sessionId = '' } = useParams();
  const sess = openedSessions.get(sessionId);
  const go = useNavigate();
  const save = useSaveAttendance(sessionId);
  const slot = useStaffToday().data?.sessions.find((s) => sess?.slotId && s.slotId === sess.slotId);
  const [absent, setAbsent] = useState(() => new Set(sess?.absentIds ?? []));

  // Code mode: absent = not checked in yet, unless the teacher tapped the tile (fixed: id -> absent).
  const [code, setCode] = useState(false);
  const [fixed, setFixed] = useState(() => new Map<string, boolean>());
  const live = useCode(sessionId, code).data;

  useEffect(() => {
    document.body.classList.add('attending');
    return () => document.body.classList.remove('attending');
  }, []);

  // Opened without going through Today / Past session (e.g. a reload): the API can't re-fetch a session by id.
  if (!sess) return <Navigate to="/t" replace />;

  const n = sess.roster.length;
  const open = code && !!live?.code;
  const codeAbsent = new Set(sess.roster.map((s) => s.id).filter((id) => fixed.get(id) ?? !live?.checkedIn.includes(id)));
  const shown = code ? codeAbsent : absent;
  const toggle = (id: string) => code ? setFixed((m) => new Map(m).set(id, !shown.has(id))) : setAbsent((a) => { const b = new Set(a); if (!b.delete(id)) b.add(id); return b; });
  const cnt = <div className="cnt"><b>{n - shown.size}</b> present · <b className={shown.size ? 'neg' : ''}>{shown.size}</b> absent</div>;
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
          <button type="button" role="tab" aria-selected={!code} className={code ? 'tab' : 'tab on'} onClick={() => setCode(false)}>Roll</button>
          <button type="button" role="tab" aria-selected={code} className={code ? 'tab on' : 'tab'} onClick={() => setCode(true)}>Code</button>
        </div>
      </div>
      {code && <CodeMode sessionId={sessionId} roster={sess.roster} />}
      <div className="row between big-cnt" style={{ marginBottom: 'var(--s2)' }}>
        {cnt}<span className="small muted">{code ? 'Tap anyone to correct.' : 'Everyone is present. Tap the absent.'}</span>
      </div>
      <Roster roster={sess.roster} absent={shown} onToggle={toggle}
        waiting={open ? new Set([...codeAbsent].filter((id) => !fixed.has(id))) : undefined} flagged={code ? new Set(live?.flagged) : undefined} />
      <div className="savebar">
        {cnt}
        <button type="button" className="btn primary" disabled={save.isPending}
          onClick={() => save.mutate([...shown], {
            onSuccess: () => { toast('Attendance saved · students updated'); go('/t'); },
            onError: (e) => toast(e.message),
          })}>Save attendance</button>
      </div>
    </>
  );
}
