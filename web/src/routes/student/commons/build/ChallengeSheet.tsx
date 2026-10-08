import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../../../api/client';
import { Avatar } from '../../../../ui/Avatar';
import { Icon } from '../../../../ui/Icon';
import { Sheet } from '../../../../ui/Sheet';
import { toast } from '../../../../ui/Toast';
import { rel } from '../../../../lib/dates';
import { Winners } from './Challenges';

export function ChallengeSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const key = ['commons', 'challenges'];
  const q = useQuery({ queryKey: [...key, id], queryFn: () => unwrap(api.GET('/commons/challenges/{id}', { params: { path: { id } } })) });
  const act = useMutation({
    mutationFn: (f: () => Promise<unknown>) => f(),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast(e.message),
  });
  const like = (sid: string) => act.mutate(() => unwrap(api.POST('/commons/submissions/{id}/like', { params: { path: { id: sid } } })));

  const c = q.data;
  if (!c) return <Sheet title="Challenge" onClose={onClose}><p className="muted">{q.error ? q.error.message : 'Loading…'}</p></Sheet>;
  const end = rel(c.endsAt.slice(0, 10));
  const subs = c.submissions.filter((s) => s != null);

  return (
    <Sheet title={c.title} onClose={onClose}>
      <div className="stack">
        <span className="small muted">{c.live ? `Ends ${end}` : `Ended ${end}`} · judged by {c.judging === 'likes' ? 'likes' : c.owner.name}</span>
        <p>{c.description}</p>
        {c.winners.length > 0 && <div className="card tint"><b><Winners w={c.winners} /></b></div>}
        <div className="eyebrow">Submissions</div>
        {subs.length ? <div className="list">{subs.map((s) => (
          <div key={s.id} className="row">
            <Avatar user={s.user} size="sm" />
            <div className="grow"><b>{s.user.name}</b>
              <div className="small">{/^https?:\/\//.test(s.url) ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a> : s.url}</div>
              {s.note && <div className="small muted">{s.note}</div>}</div>
            <button type="button" className={`btn sm ${s.likedByMe ? 'primary' : ''}`} disabled={!c.live || act.isPending} onClick={() => like(s.id)}>
              <Icon name="star" size={16} /> {s.likes}</button>
          </div>))}</div>
          : <p className="small muted">No submissions yet. Be the first.</p>}
        {c.canSubmit ? (
          <form className="stack" onSubmit={(e) => {
            e.preventDefault();
            const f = e.currentTarget, fd = new FormData(f), note = String(fd.get('note')).trim();
            act.mutate(() => unwrap(api.POST('/commons/challenges/{id}/submissions', { params: { path: { id } }, body: { url: String(fd.get('url')).trim(), ...(note && { note }) } })).then(() => f.reset()));
          }}>
            <div className="eyebrow">Submit a link</div>
            <input className="input" name="url" type="url" required placeholder="https://link-to-your-work" />
            <input className="input" name="note" placeholder="Short note (optional)" />
            <button className="btn primary" type="submit" disabled={act.isPending}>Submit link</button>
          </form>)
          : c.live && <p className="small muted">You have submitted. Thanks!</p>}
      </div>
    </Sheet>
  );
}
