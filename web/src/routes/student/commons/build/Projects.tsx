import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../../../api/client';
import type { components } from '../../../../api/schema';
import { Avatar } from '../../../../ui/Avatar';
import { toast } from '../../../../ui/Toast';

export type Card = NonNullable<components['schemas']['ProjectCard']>;
export const STATUS = { looking: 'Looking for people', building: 'Building', shipped: 'Shipped' } as const;

/** Ask to join, or show my state. `cls` styles the button (primary in the sheet, accent on the hero). */
export function JoinCta({ p, cls = 'primary' }: { p: Pick<Card, 'id' | 'me'>; cls?: string }) {
  const qc = useQueryClient();
  const join = useMutation({
    mutationFn: () => unwrap(api.POST('/commons/projects/{id}/join', { params: { path: { id: p.id } }, body: {} })),
    onSuccess: () => { toast('Request sent'); return qc.invalidateQueries({ queryKey: ['commons', 'projects'] }); },
    onError: (e) => toast(e.message),
  });
  if (p.me === 'member') return <span className="chip vio">You are on the team</span>;
  if (p.me === 'requested') return <span className="chip">Request sent</span>;
  return <button type="button" className={`btn ${cls}`} disabled={join.isPending} onClick={() => join.mutate()}>Ask to join</button>;
}

export const Roles = ({ roles }: { roles: string[] }) => <div className="fl">{roles.map((r) => <span key={r} className="chip">{r}</span>)}</div>;

export function ProjectCard({ p, feat, onOpen }: { p: Card; feat?: boolean; onOpen: (id: string) => void }) {
  return (
    <div className={feat ? 'card click tint' : 'card click'} role="button" tabIndex={0} onClick={() => onOpen(p.id)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(p.id)}>
      {feat && <div className="eyebrow" style={{ color: 'var(--secondary)' }}>{p.community ? 'Community' : 'Featured'}</div>}
      <div className="row between"><h3>{p.title}</h3><span className="chip vio">{STATUS[p.status]}</span></div>
      <p className="small muted clamp" style={{ margin: 'var(--s1) 0 var(--s2)' }}>{p.description}</p>
      <div className="fl">{p.crossBranch && <span className="chip vio">Cross-branch</span>}{p.roles.map((r) => <span key={r} className="chip">{r}</span>)}</div>
      <div className="row" style={{ marginTop: 'var(--s2)' }}>
        <div className="avatars">{p.members.slice(0, 4).map((m) => <Avatar key={m.id} user={m} size="sm" />)}</div>
        <span className="small muted">{p.members.length} on the team</span>
      </div>
    </div>
  );
}
