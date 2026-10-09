import { useState } from 'react';
import { Avatar } from '../../../ui/Avatar';
import { Badge } from '../../../ui/Badge';
import { Empty } from '../../../ui/Empty';
import { Icon } from '../../../ui/Icon';
import { Sheet } from '../../../ui/Sheet';
import { toast } from '../../../ui/Toast';
import { localPreview } from '../classes/NewClass';
import { useInvitePreview, useRoster, useRosterActions } from '../queries';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const err = (e: unknown) => toast((e as Error).message);

/** PROTO teacher.html:150-167 (paste sheet) reusing TE-07's parser; the server dry-run adds clashes with existing accounts. */
function AddSheet({ classId, onClose }: { classId: string; onClose: () => void }) {
  const [text, setText] = useState('');
  const [server, setServer] = useState<{ text: string; rows: ReturnType<typeof localPreview> }>();
  const dry = useInvitePreview();
  const { invite } = useRosterActions(classId);
  const rows = server?.text === text ? server.rows : localPreview(text);
  const ok = rows.filter((r) => !r.issue), dup = rows.filter((r) => r.issue === 'Duplicate').length, bad = rows.filter((r) => r.issue === 'Bad email').length;
  const change = (v: string) => {
    setText(v);
    const r = localPreview(v);
    if (r.length) dry.mutate({ id: classId, rows: r.map(({ studentIdNo, email }) => ({ studentIdNo, email })) }, { onSuccess: (d) => setServer({ text: v, rows: d.rows }) });
  };
  const send = () => invite.mutate(ok.map(({ studentIdNo, email }) => ({ studentIdNo, email })), {
    onSuccess: (d) => { toast(`Invites sent to ${plural(d.ready, 'student')}`); onClose(); }, onError: err,
  });
  return (
    <Sheet title="Add students" onClose={onClose}>
      <div className="stack">
        <div className="field"><label htmlFor="ta-add">Paste student ID and email</label>
          <textarea className="input" id="ta-add" placeholder="24CSA031, name@students.demo.edu" value={text} onChange={(e) => change(e.target.value)} /></div>
        {!rows.length ? <p className="muted small">Paste one student per line: ID, email. A spreadsheet copy works too.</p> : (
          <>
            <p className="small"><b>{ok.length}</b> ready{dup > 0 && <> · <span style={{ color: 'var(--warn)' }}>{dup} duplicate</span></>}{bad > 0 && <> · <span style={{ color: 'var(--danger)' }}>{bad} bad email</span></>}</p>
            <table className="tbl"><thead><tr><th>ID</th><th>Email</th><th></th></tr></thead><tbody>{rows.map((r, i) => (
              <tr key={i}><td>{r.studentIdNo}</td><td>{r.email || <span className="muted">missing</span>}</td>
                <td>{r.issue ? <Badge kind={r.issue === 'Duplicate' ? 'warn' : 'danger'}>{r.issue}</Badge> : <Badge kind="open">Ready</Badge>}</td></tr>))}</tbody></table>
          </>)}
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn primary" disabled={!ok.length || invite.isPending} onClick={send}>Send invites</button>
      </div>
    </Sheet>
  );
}

/** PROTO tabStudents (teacher.html:362). `canEdit`: class teacher or admin (Add, Make CR, Resend, Remove). */
export function StudentsTab({ classId, canEdit }: { classId: string; canEdit: boolean }) {
  const roster = useRoster(classId);
  const { resend, setCr, remove } = useRosterActions(classId);
  const [adding, setAdding] = useState(false);
  const [replacing, setReplacing] = useState<{ id: string; name: string }>(); // third CR: ask whom to replace
  if (!roster.data) return null;
  const all = roster.data;
  const crIds = all.filter((s) => s.isCR).map((s) => s.id);
  return (
    <div className="stack">
      <div className="row between wrap">
        <p className="muted small">{plural(all.length, 'student')} · {all.filter((s) => s.status === 'invited').length} invited</p>
        {canEdit && <button type="button" className="btn" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add students</button>}
      </div>
      <div className="card">{all.length ? (
        <div className="list">{all.map((s) => (
          <div key={s.id} className="item wrap">
            <Avatar user={s} size="sm" />
            <div className="grow"><b>{s.name}</b> {s.isCR && <Badge kind="questions">CR</Badge>}
              {s.studentIdNo && <div className="tiny muted">{s.studentIdNo} · {s.email}</div>}</div>
            {s.status === 'invited'
              ? <><Badge kind="warn">Invited</Badge>
                {canEdit && <button type="button" className="btn sm" disabled={resend.isPending} onClick={() => resend.mutate(s.id, { onSuccess: () => toast(`Invite resent to ${s.email}`), onError: err })}>Resend</button>}</>
              : <Badge kind="open">Active</Badge>}
            {canEdit && s.isCR && (
              // The server refuses an empty set (min 1 CR), so the sole CR can only be replaced.
              <button type="button" className="btn sm" disabled={setCr.isPending || crIds.length < 2} title={crIds.length < 2 ? 'Make another student CR to replace this one' : undefined}
                onClick={() => setCr.mutate(crIds.filter((id) => id !== s.id), { onSuccess: () => toast(`${s.name} is no longer CR`), onError: err })}>Remove CR</button>)}
            {canEdit && !s.isCR && s.status === 'active' && (
              <button type="button" className="btn sm" disabled={setCr.isPending}
                onClick={() => crIds.length < 2 ? setCr.mutate([...crIds, s.id], { onSuccess: () => toast(`${s.name} is now CR`), onError: err }) : setReplacing(s)}>Make CR</button>)}
            {canEdit && <button type="button" className="btn sm ghost" disabled={remove.isPending} onClick={() => confirm(`Remove ${s.name} from this class?`) && remove.mutate(s.id, { onSuccess: () => toast(`${s.name} removed`), onError: err })}>Remove</button>}
          </div>))}</div>
      ) : <Empty seed="welcome" text="No students yet. Add some to send invites." />}</div>
      {replacing && (
        <Sheet title={`Make ${replacing.name} CR`} onClose={() => setReplacing(undefined)}>
          <p className="small">A class has at most 2 CRs. Who should {replacing.name} replace?</p>
          <div className="actions">
            {all.filter((s) => s.isCR).map((c) => (
              <button key={c.id} type="button" className="btn" disabled={setCr.isPending}
                onClick={() => setCr.mutate(crIds.map((id) => id === c.id ? replacing.id : id), { onSuccess: () => { toast(`${replacing.name} replaces ${c.name} as CR`); setReplacing(undefined); }, onError: err })}>{c.name}</button>))}
            <button type="button" className="btn ghost" onClick={() => setReplacing(undefined)}>Cancel</button>
          </div>
        </Sheet>)}
      {adding && <AddSheet classId={classId} onClose={() => setAdding(false)} />}
    </div>
  );
}
