import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../../../api/client';
import { Avatar } from '../../../../ui/Avatar';
import { Icon } from '../../../../ui/Icon';
import { Sheet } from '../../../../ui/Sheet';
import { toast } from '../../../../ui/Toast';
import { rel } from '../../../../lib/dates';
import { JoinCta, Roles, STATUS } from './Projects';

const Eyebrow = ({ children }: { children: string }) => <div className="eyebrow" style={{ marginBottom: 'var(--s1)' }}>{children}</div>;

export function ProjectSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['commons', 'projects', id], queryFn: () => unwrap(api.GET('/commons/projects/{id}', { params: { path: { id } } })) });
  const act = useMutation({
    mutationFn: (f: () => Promise<unknown>) => f(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commons', 'projects'] }),
    onError: (e) => toast(e.message),
  });
  const decide = (reqId: string, state: 'accepted' | 'declined') =>
    act.mutate(() => unwrap(api.POST('/commons/join-requests/{id}', { params: { path: { id: reqId } }, body: { state } })));

  const p = q.data;
  if (!p) return <Sheet title="Project" onClose={onClose}><p className="muted">{q.error ? q.error.message : 'Loading…'}</p></Sheet>;

  return (
    <Sheet title={p.title} onClose={onClose}>
      <div className="stack">
        <div className="row between">
          <div className="fl"><span className="chip vio">{STATUS[p.status]}</span>{p.crossBranch && <span className="chip vio">Cross-branch</span>}</div>
          <JoinCta p={p} />
        </div>
        <p>{p.description}</p>
        {p.repoUrl && <a className="row small" href={p.repoUrl} target="_blank" rel="noopener noreferrer"><Icon name="github" size={16} /> {p.repoUrl}</a>}
        <div><Eyebrow>Roles needed</Eyebrow><Roles roles={p.roles} /></div>
        <div><Eyebrow>Team</Eyebrow><div className="list">{p.members.map((m) => (
          <div key={m.id} className="row"><Avatar user={m} size="sm" />
            <div className="grow"><div>{m.name}</div>{m.label && <span className="pl">{m.label}</span>}</div>
            <span className="small muted">{m.role}</span></div>))}</div></div>
        {p.mine && <>
          <div><Eyebrow>Join requests</Eyebrow>
            {p.requests.length ? <div className="list">{p.requests.map((r) => (
              <div key={r.id} className="stack" style={{ gap: 'var(--s1)' }}>
                <div className="row"><Avatar user={r.user} size="sm" /><b>{r.user.name}</b>{r.user.label && <span className="pl">{r.user.label}</span>}</div>
                <div className="small muted">{r.note || 'No note'}</div>
                <div className="row">
                  <button type="button" className="btn sm primary" disabled={act.isPending} onClick={() => decide(r.id, 'accepted')}>Accept</button>
                  <button type="button" className="btn sm" disabled={act.isPending} onClick={() => decide(r.id, 'declined')}>Decline</button>
                </div>
              </div>))}</div>
              : <p className="small muted">No pending requests.</p>}
          </div>
        </>}
        {p.me === 'member' && (
          <form className="stack" onSubmit={(e) => {
            e.preventDefault();
            const f = e.currentTarget;
            const body = String(new FormData(f).get('body')).trim();
            act.mutate(() => unwrap(api.POST('/commons/projects/{id}/updates', { params: { path: { id } }, body: { body } })).then(() => f.reset()));
          }}>
            <div className="eyebrow">Post an update</div>
            <textarea className="input" name="body" required placeholder="What did the team just do?" />
            <button className="btn" type="submit" disabled={act.isPending}>Post update</button>
          </form>)}
        <div><Eyebrow>Contribution log</Eyebrow>
          {p.updates.length ? <div className="list">{p.updates.map((u) => (
            <div key={u.id} className="row" style={{ alignItems: 'flex-start' }}>
              <span className="ico"><Icon name={u.source === 'github' ? 'github' : 'edit'} /></span>
              <div className="grow"><div className="small">{u.body}</div>
                <div className="tiny muted">{u.author.name} · {rel(u.createdAt.slice(0, 10))}{u.source === 'github' ? ' · commit' : ''}</div></div>
            </div>))}</div>
            : <p className="small muted">No updates yet.</p>}
        </div>
      </div>
    </Sheet>
  );
}
