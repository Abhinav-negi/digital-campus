import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import { Avatar } from '../../../ui/Avatar';
import { Badge } from '../../../ui/Badge';
import { Empty } from '../../../ui/Empty';
import { Icon } from '../../../ui/Icon';

// PROTO teacher.html:296-314.
export function Component() {
  const go = useNavigate();
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => unwrap(api.GET('/classes')) });
  const posts = useQuery({ queryKey: ['posts', 'mine'], queryFn: () => unwrap(api.GET('/posts/mine')) });
  const list = (classes.data?.items ?? []).filter((c) => !c.archivedAt);

  return (
    <>
      <div className="page-head"><div><div className="eyebrow">Your classes</div><h1>Classes</h1><p className="muted">One card per class you teach.</p></div>
        <Link className="btn primary" to="/t/classes/new"><Icon name="plus" /> New class</Link></div>
      {classes.error && <p className="muted">{classes.error.message}</p>}
      {classes.data && !list.length && <Empty text="No classes yet. Create one, or wait for a CR to add you to a subject." />}
      <div className="grid grid-2">{list.map((c) => {
        const lp = posts.data?.items.find((p) => p.classes.some((x) => x.id === c.id));
        const s = lp?.stats;
        return (
          <div key={c.id} className="card click lift" role="link" tabIndex={0}
            onClick={() => go(`/t/classes/${c.id}`)} onKeyDown={(e) => e.key === 'Enter' && go(`/t/classes/${c.id}`)}>
            <div className="row between"><h3>{c.name}</h3>{c.myRole === 'classTeacher' && <Badge kind="questions" plain>Class teacher</Badge>}</div>
            <p className="muted small">{c.termLabel}{c.mySubjects.length > 0 && ` · you teach ${c.mySubjects.join(', ')}`}</p>
            <div className="stats">
              <div className="stat"><div className="num">{c.counts.students}</div><div className="lbl">students{c.invited > 0 && ` · ${c.invited} invited`}</div></div>
              <div className="stat"><div className="num">{c.myAttendancePct == null ? '–' : `${c.myAttendancePct}%`}</div><div className="lbl">avg attendance</div></div>
              <div className="stat"><div className="num">{s?.total ? `${Math.round((100 * s.seen) / s.total)}%` : '–'}</div><div className="lbl">last post seen</div></div></div>
            <div className="row">{c.crs.map((u) => <Avatar key={u.id} user={u} size="sm" />)}<span className="small muted grow">CR · {c.crs.map((u) => u.name).join(', ') || 'none yet'}</span></div>
            {lp && <p className="tiny muted" style={{ marginTop: 'var(--s1)' }}>Last post: {lp.title}{s ? ` · ${s.seen} of ${s.total} seen` : ''}</p>}
          </div>
        );
      })}</div>
    </>
  );
}
