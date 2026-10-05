import type { components } from '../../../api/schema';
import { Avatar } from '../../../ui/Avatar';
import { Icon, type IconName } from '../../../ui/Icon';
import { rel } from '../../../lib/dates';

export type Post = components['schemas']['BoardPostCard'];

export const KIND: Record<Post['kind'], [string, IconName]> = { ask: ['Ask', 'chat'], gig: ['Gig', 'code'], market: ['Market', 'star'], lost: ['Lost', 'search'], found: ['Found', 'check'] };
const MT = { sell: 'Sell', buy: 'Wanted', give: 'Give away', lend: 'Lend' };
const CLOSED = ['solved', 'sold', 'given', 'returned', 'done'];
const NOUN = { ask: 'answer', gig: 'interested', found: 'claim' } as const;
const price = (p: Post) => (p.kind === 'gig' ? `₹${p.price} · ${p.priceType === 'negotiable' ? 'negotiable' : 'fixed'}` : p.price === 0 ? 'Free' : `₹${p.price}`);

/** `onOpen` is the hook ST-07b uses to open the post sheet. */
export function BoardCard({ p, onOpen }: { p: Post; onOpen?: (id: string) => void }) {
  const [label, icon] = KIND[p.kind];
  const closed = CLOSED.includes(p.status);
  const noun = p.kind === 'ask' || p.kind === 'gig' || p.kind === 'found' ? NOUN[p.kind] : undefined;
  return (
    <div className={`card click k-${p.kind}${closed ? ' closed' : ''}`} role="button" tabIndex={0}
      onClick={() => onOpen?.(p.id)} onKeyDown={(e) => e.key === 'Enter' && onOpen?.(p.id)}>
      <div className="stack" style={{ gap: 'var(--s1)' }}>
        <div className="row">
          <span className="kico"><Icon name={icon} size={16} /></span><span className="kl">{label}</span><span className="grow" />
          {(closed || p.status === 'assigned') && <span className={closed ? 'badge plain' : 'badge plain warn'}>{p.status[0]!.toUpperCase() + p.status.slice(1)}</span>}
          <span className="tiny muted">{rel(p.createdAt.slice(0, 10))}</span>
        </div>
        <h4>{p.title}</h4>
        <p className="small muted clamp">{p.body ?? ''}</p>
        <div className="fl">
          {p.kind === 'market' && p.marketType && <span className="chip">{MT[p.marketType]}</span>}
          {p.price != null && <span className="chip">{price(p)}</span>}
          {p.place && <span className="chip">{p.place}</span>}
          {p.kind === 'gig' && p.deadline && <span className="chip">Due {rel(p.deadline)}</span>}
        </div>
        <div className="row" style={{ marginTop: 'var(--s1)' }}>
          <Avatar user={p.author} size="sm" /><span className="small">{p.author.name}</span>
          {p.author.label && <span className="pl">{p.author.label}</span>}
          {p.author.otherBranch && <span className="pl xb">Other branch</span>}
          {noun && <span className="chip">{p.count} {noun}{p.count !== 1 && noun !== 'interested' ? 's' : ''}</span>}
        </div>
      </div>
    </div>
  );
}
