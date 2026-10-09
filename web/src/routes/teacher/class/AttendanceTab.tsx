import { useState } from 'react';
import { Avatar } from '../../../ui/Avatar';
import { Bar } from '../../../ui/Bar';
import { Badge, Chip } from '../../../ui/Badge';
import { Empty } from '../../../ui/Empty';
import { useAttendanceSubjects, useClassAttendance } from '../queries';

/** PROTO tabAttendance (teacher.html:372). `all`: class teacher / admin see every subject, a subject teacher only theirs. */
export function AttendanceTab({ classId, userId, all, minPct }: { classId: string; userId?: string; all: boolean; minPct: number }) {
  const subs = useAttendanceSubjects(classId, userId, all);
  const [pick, setPick] = useState('');
  const sub = subs.data?.find((s) => s.id === pick) ?? subs.data?.[0];
  const att = useClassAttendance(classId, sub?.id);
  if (!subs.data) return null;
  if (!subs.data.length) return <Empty seed="chalk" text="No subjects of yours in this class yet." />;
  const d = att.data;
  return (
    <div className="stack">
      {subs.data.length > 1 && <div className="row wrap">{subs.data.map((s) => <Chip key={s.id} on={s.id === sub?.id} onClick={() => setPick(s.id)}>{s.name}</Chip>)}</div>}
      {att.error && <p className="muted">{att.error.message}</p>}
      {d && (
        <>
          <p className="muted small">{d.subject.name} · lowest first · {d.belowCount ? <><b>{d.belowCount}</b> below the {d.min}% minimum</> : `everyone is above ${d.min}%`}</p>
          <div className="card">{d.rows.length ? (
            <div className="list">{d.rows.map(({ student, pct, present, total, status }) => (
              <div key={student.id} className="row">
                <Avatar user={student} size="sm" />
                <div className="grow">
                  <div className="row between"><b>{student.name}</b><span className="small"><b>{pct}%</b> <span className="muted">{present}/{total}</span></span></div>
                  <div style={{ marginTop: 'var(--s1)' }}><Bar pct={pct} status={status} /></div>
                </div>
                {pct < (d.min ?? minPct) && <Badge kind="danger">Below minimum</Badge>}
              </div>))}</div>
          ) : <Empty seed="chalk" text="No active students yet." />}</div>
        </>)}
    </div>
  );
}
