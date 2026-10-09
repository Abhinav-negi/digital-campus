import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../../../../api/client';
import type { components } from '../../../../api/schema';
import type { Moderation } from '../BoardCard';
import { Empty } from '../../../../ui/Empty';
import { Icon } from '../../../../ui/Icon';
import { rel } from '../../../../lib/dates';

export type Chal = NonNullable<components['schemas']['ChallengeCard']>;

export const Winners = ({ w }: { w: Chal['winners'] }) => {
  const names = w.filter((x) => x != null).map((x) => x.name).join(', ');
  return names ? <span className="chip vio"><Icon name="star" size={16} /> Winner: {names}</span> : null;
};

export function Challenges({ onOpen, onNew, moderation }: { onOpen: (id: string) => void; onNew: () => void; moderation?: Moderation }) {
  const q = useQuery({ queryKey: ['commons', 'challenges', !!moderation], queryFn: () => unwrap(api.GET('/commons/challenges', { params: { query: { includeHidden: moderation ? '1' : undefined } } })) });
  const list = q.data?.items.filter((c) => c != null);
  return (
    <>
      <div className="row between" style={{ margin: 'var(--s6) 0 var(--s3)' }}>
        <h3>Challenges</h3>
        <button type="button" className="btn primary" onClick={onNew}><Icon name="plus" size={16} /> New challenge</button>
      </div>
      {!list ? <p className="muted">{q.error ? q.error.message : 'Loading…'}</p>
        : list.length ? <div className="grid grid-2">{list.map((c) => (
          <div key={c.id} className="card click" role="button" tabIndex={0} onClick={() => onOpen(c.id)} onKeyDown={(e) => e.key === 'Enter' && onOpen(c.id)}>
            <div className="row between"><h4>{c.title}</h4>
              <span className="chip">{c.live ? `Ends ${rel(c.endsAt.slice(0, 10))}` : 'Ended'}</span></div>
            <p className="small muted clamp" style={{ margin: 'var(--s1) 0' }}>{c.description}</p>
            <div className="small muted">{c.submissionCount} submission{c.submissionCount === 1 ? '' : 's'} · by {c.owner.name}</div>
            {c.winners.length > 0 && <div style={{ marginTop: 'var(--s1)' }}><Winners w={c.winners} /></div>}
            {moderation?.({ type: 'challenge', id: c.id, title: c.title, text: c.description, authorId: c.owner.id, hidden: !!c.hiddenAt })}
          </div>))}</div>
          : <Empty seed="challenges" text="No challenges yet. Start one." />}
    </>
  );
}
