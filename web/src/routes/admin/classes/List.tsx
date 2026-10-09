import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Badge } from '../../../ui/Badge';
import { Empty } from '../../../ui/Empty';
import { Icon } from '../../../ui/Icon';
import { useAdminBranches, useAdminClasses } from '../queries';

// AF-03: every class grouped branch → year, with health flags (no subjects/timetable, no CR, invites pending).
export function Component() {
  const go = useNavigate();
  const q = useAdminClasses();
  const branches = useAdminBranches();
  const [branchId, setBranchId] = useState('');
  const [archived, setArchived] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const flags = (c: NonNullable<typeof q.data>[number]) => [
    !c.counts.subjects && 'No timetable', !c.crs.length && 'No CR', c.invited > 0 && `${c.invited} invited`,
  ].filter(Boolean) as string[];
  const list = (q.data ?? []).filter((c) => !!c.archivedAt === archived && (!branchId || c.branch.id === branchId) && (!flagged || flags(c).length));
  const groups = new Map<string, typeof list>();
  for (const c of list.sort((a, b) => a.branch.code.localeCompare(b.branch.code) || a.yearOfStudy - b.yearOfStudy || a.name.localeCompare(b.name))) {
    const k = `${c.branch.code} · Year ${c.yearOfStudy}`;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  return (
    <>
      <div className="page-head"><div><h1>Classes</h1><p className="muted">Every batch. Open one to edit its board, students and settings.</p></div>
        <Link className="btn primary" to="/a/classes/new"><Icon name="plus" /> New class</Link></div>
      <div className="row" style={{ flexWrap: 'wrap', margin: 'var(--s2) 0' }}>
        <select className="input" aria-label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">All branches</option>{branches.data?.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select>
        <label className="row small"><input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} /> Needs attention</label>
        <label className="row small"><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Archived</label>
      </div>
      {q.error && <p className="muted">{q.error.message}</p>}
      {q.data && !list.length && <Empty text="No classes match." />}
      {[...groups].map(([k, cs]) => (
        <section key={k} style={{ marginBottom: 'var(--s4)' }}>
          <p className="eyebrow">{k}</p>
          <div className="grid grid-2">{cs.map((c) => (
            <div key={c.id} className="card click lift" role="link" tabIndex={0} onClick={() => go(`/a/classes/${c.id}`)} onKeyDown={(e) => e.key === 'Enter' && go(`/a/classes/${c.id}`)}>
              <div className="row between wrap"><h3>{c.name}</h3><span className="row wrap">{flags(c).map((f) => <Badge key={f} kind="warn">{f}</Badge>)}</span></div>
              <p className="muted small">{c.termLabel} · {c.counts.students} students · {c.counts.subjects} subjects</p>
              <p className="small muted">Class teacher · {c.classTeacher.name} · CR · {c.crs.map((u) => u.name).join(', ') || 'none yet'}</p>
              <Link className="small" to={`/a/classes/${c.id}/correct`} onClick={(e) => e.stopPropagation()}>Correct attendance</Link>
            </div>))}</div>
        </section>))}
    </>
  );
}
