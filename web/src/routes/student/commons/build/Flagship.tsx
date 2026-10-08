import { Icon } from '../../../../ui/Icon';
import { Avatar } from '../../../../ui/Avatar';
import { JoinCta, Roles, type Card } from './Projects';

export function Flagship({ p, onOpen }: { p: Card; onOpen: (id: string) => void }) {
  const repo = p.repoUrl?.replace(/\/$/, '');
  const open = (u: string) => window.open(u, '_blank', 'noopener');
  return (
    <div className="card hero flag"><div className="stack">
      <div className="eyebrow">SoET Open Source · this semester's flagship</div>
      <h2>{p.title.split(' · ')[0]}</h2>
      <p className="muted clamp">{p.description}</p>
      <Roles roles={p.roles} />
      <div className="row wrap" style={{ gap: 'var(--s2)' }}>
        <div className="row" style={{ gap: 'var(--s1)' }}>
          {p.members.map((m) => <div key={m.id} className="mem"><Avatar user={m} size="sm" /><span className="tiny">{m.branch?.code ?? ''}</span></div>)}
        </div>
        <span className="small muted">{p.members.length} on the team across {p.branches.length} branches: {p.branches.join(', ')}</span>
      </div>
      <div className="row wrap">
        <JoinCta p={p} cls="accent" />
        {repo && <>
          <button type="button" className="btn" onClick={() => open(`${repo}/issues`)}>Open issues</button>
          <button type="button" className="btn ghost" style={{ color: '#fff' }} onClick={() => open(repo)}><Icon name="github" size={16} /> Repo</button>
        </>}
        <button type="button" className="btn ghost" style={{ color: '#fff' }} onClick={() => onOpen(p.id)}>Details</button>
      </div>
    </div></div>
  );
}
