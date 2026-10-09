import { useState } from 'react';
import { Empty } from '../../../ui/Empty';
import { Sheet } from '../../../ui/Sheet';
import { useConversationMessages, useConversations } from '../queries';

// AF-04b: admins read any conversation (ARCH D2). Read-only; each open is audited by the API.
function Thread({ id, who, onClose }: { id: string; who: string; onClose: () => void }) {
  const msgs = useConversationMessages(id);
  return (
    <Sheet title={who} onClose={onClose}>
      <div className="card tint small">Reading is logged.</div>
      <div className="msgs">
        {msgs.error ? <p className="muted">{msgs.error.message}</p> : msgs.data?.items.map((m) => <div key={m.id} className="msg">{m.body}</div>)}
      </div>
    </Sheet>
  );
}

export function Conversations() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<{ id: string; who: string }>();
  const list = useConversations(q.trim());
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="stack">
      <p className="card tint small">Reading is logged. Opening a conversation writes an audit entry.</p>
      <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or text" aria-label="Search conversations" />
      {list.error ? <p className="muted">{list.error.message}</p> : !list.isLoading && !items.length ? <Empty seed="conversations" text="No conversations found." /> : (
        <div className="list">{items.map((c) => (
          <div key={c.id} className="row-item" role="button" tabIndex={0} onClick={() => setOpen({ id: c.id, who: `${c.from.name} and ${c.to.name}` })}
            onKeyDown={(e) => e.key === 'Enter' && setOpen({ id: c.id, who: `${c.from.name} and ${c.to.name}` })}>
            <div className="grow"><h4>{c.from.name} to {c.to.name}</h4><p className="muted small clamp">{c.lastMessage ?? c.note}</p></div>
            <span className="muted tiny">{c.state}</span>
          </div>))}
        </div>)}
      {list.hasNextPage && <button type="button" className="btn" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>Load more</button>}
      {open && <Thread {...open} onClose={() => setOpen(undefined)} />}
    </div>
  );
}
