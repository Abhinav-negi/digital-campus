import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import { Bar } from '../../../ui/Bar';
import { Empty } from '../../../ui/Empty';

const COL = { safe: 'var(--success)', warn: 'var(--warn)', danger: 'var(--danger)' } as const;

/** PROTO bAttendance (student.html:230): a card per subject. */
export function MyAttendance({ classId, isCr }: { classId: string; isCr: boolean }) {
  const q = useQuery({ queryKey: ['me', 'attendance'], queryFn: () => unwrap(api.GET('/me/attendance')) });
  if (!q.data) return null;
  const items = q.data.items.filter((a) => a.class.id === classId);
  if (!items.length) return <Empty text="No attendance recorded yet." />;
  return (
    <div className="stack">
      {items.map((a) => (
        <div key={a.subject.id} className="card stack" style={{ gap: 'var(--s1)' }}>
          <div className="row between"><h4>{a.subject.name}</h4><b>{a.pct}%</b></div>
          <Bar pct={a.pct} status={a.status} />
          <div className="row between small"><span className="muted">{a.present} of {a.total} classes · minimum {a.min}%</span><span style={{ color: COL[a.status] }}>{a.text}</span></div>
          <div className="dots" style={{ marginTop: 'var(--s1)', justifyContent: 'flex-start' }}>
            {a.history.map((h) => <i key={h.date} className={h.present ? 'dot' : 'dot a'} title={`${h.date}: ${h.present ? 'present' : 'absent'}`} />)}
          </div>
        </div>))}
      <p className="tiny muted">Attendance is recorded by your teachers{isCr ? '; as CR you can edit the board, but not attendance' : ''}. Only you can see yours.</p>
    </div>
  );
}
