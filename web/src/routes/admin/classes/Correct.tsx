import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import { Chip } from '../../../ui/Badge';
import { toast } from '../../../ui/Toast';
import { openAttendance } from '../../teacher/queries';

// AF-03: admin attendance correction. POST /attendance-sessions is idempotent and lets an admin open any date; the roll itself is the TE-02 page.
export function Component() {
  const { id = '' } = useParams();
  const go = useNavigate();
  const subs = useQuery({ queryKey: ['classes', id, 'subjects', 'admin'], queryFn: async () => (await unwrap(api.GET('/classes/{id}/subjects', { params: { path: { id } } }))).items });
  const [pick, setPick] = useState('');
  const [date, setDate] = useState(() => new Date().toLocaleDateString('sv'));
  const subject = pick || subs.data?.[0]?.id;
  const open = async () => {
    try { go(`/t/attend/${(await openAttendance({ subjectId: subject!, date })).id}`); } catch (e) { toast((e as { message: string }).message); }
  };
  return (
    <>
      <Link className="backlink" to={`/a/classes/${id}`}>← Class</Link>
      <div className="page-head"><div><h1>Correct attendance</h1><p className="muted">Pick a subject and a date, then fix the roll. Every change is audited.</p></div></div>
      {subs.error && <p className="muted">{subs.error.message}</p>}
      <div className="card stack" style={{ maxWidth: 480 }}>
        <div className="row wrap">{subs.data?.map((s) => <Chip key={s.id} on={s.id === subject} onClick={() => setPick(s.id)}>{s.name}</Chip>)}</div>
        {subs.data && !subs.data.length && <p className="muted">This class has no subjects yet.</p>}
        <div className="field"><label htmlFor="cad">Date</label><input className="input" id="cad" type="date" value={date} max={new Date().toLocaleDateString('sv')} onChange={(e) => setDate(e.target.value)} /></div>
        <button type="button" className="btn primary" disabled={!subject || !date} onClick={open}>Open the roll</button>
      </div>
    </>
  );
}
