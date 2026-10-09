import { Empty } from '../../../ui/Empty';
import { Chip } from '../../../ui/Badge';
import { Icon } from '../../../ui/Icon';
import { toast } from '../../../ui/Toast';
import { rel } from '../../student/class/PostSheet';
import { useClassPosts, useRemind } from '../queries';

/** PROTO tabPosts (teacher.html:340): my posts to this class with the seen bar + Remind. `userId` undefined = admin, sees every author's. */
export function PostsTab({ classId, userId, onNew }: { classId: string; userId?: string; onNew: () => void }) {
  const q = useClassPosts(classId);
  const remind = useRemind();
  if (!q.data) return null;
  const items = q.data.filter((p) => !userId || p.author.id === userId);
  if (!items.length) return <Empty text="You have not posted to this class yet." action={<button type="button" className="btn primary" onClick={onNew}>New post</button>} />;
  return (
    <div className="stack">{items.map((p) => {
      const seen = p.stats?.seen ?? 0, total = p.stats?.total ?? 0, pct = total ? Math.round((100 * seen) / total) : 0;
      return (
        <div className="card" key={p.id}>
          <div className="small muted">{p.kind === 'assignment' ? 'Assignment' : 'Announcement'} · {rel(p.createdAt)}{!userId ? ` · ${p.author.name}` : ''}</div>
          <h3 style={{ marginTop: 'var(--s1)' }}>{p.title}</h3>
          <p className="small muted">{p.body}</p>
          <div className="tiny muted" style={{ marginTop: 'var(--s1)' }}>To {p.classes.map((c) => c.name).join(' · ')}</div>
          {p.dueAt && <div style={{ marginTop: 'var(--s1)' }}><Chip tone="due">Due {new Date(p.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Chip></div>}
          {p.fileUrl && <a className="small" href={p.fileUrl} target="_blank" rel="noreferrer"><Icon name="file" size={14} /> {p.fileName ?? 'Attachment'}</a>}
          <div className="row" style={{ marginTop: 'var(--s2)' }}>
            <div className="grow stack" style={{ gap: 'var(--s1)' }}>
              <div className="small"><b>{seen} of {total}</b> seen</div>
              <div className="bar"><i style={{ width: `${pct}%` }} /></div>
            </div>
            <button type="button" className="btn sm" disabled={seen >= total || remind.isPending}
              onClick={() => remind.mutate(p.id, { onSuccess: (r) => toast(`Reminder sent to ${r.reminded}`), onError: (e) => toast(e.message) })}>
              <Icon name="bell" size={16} /> Remind
            </button>
          </div>
        </div>);
    })}</div>
  );
}
