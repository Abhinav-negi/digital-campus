import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import { Chip } from '../../../ui/Badge';
import { Empty } from '../../../ui/Empty';
import { BoardCard, type Moderation } from './BoardCard';

type Kind = 'all' | 'ask' | 'gig' | 'market' | 'lf';
const CHIPS: [Kind, string][] = [['all', 'All'], ['ask', 'Ask'], ['gig', 'Gigs'], ['market', 'Market'], ['lf', 'Lost & Found']];

export function Board({ onOpen, moderation }: { onOpen?: (id: string) => void; moderation?: Moderation }) {
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [branchId, setBranchId] = useState('');
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(t); }, [q]);

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => unwrap(api.GET('/branches')) });
  const feed = useInfiniteQuery({
    queryKey: ['commons', 'board', kind, branchId, dq, !!moderation],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => unwrap(api.GET('/commons/board-posts', {
      params: { query: { kind, branchId: branchId || undefined, q: dq || undefined, cursor: pageParam, limit: 20, includeHidden: moderation ? '1' : undefined } },
    })),
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <div className="stack">
        <div className="bfilters">
          <input className="input" type="search" placeholder="Search the board" aria-label="Search the board" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" aria-label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">All branches</option>
            {branches.data?.items.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
          </select>
        </div>
        <div className="fl">{CHIPS.map(([k, l]) => <Chip key={k} on={kind === k} onClick={() => setKind(k)}>{l}</Chip>)}</div>
      </div>
      <div style={{ marginTop: 'var(--s3)' }}>
        {feed.error ? <p className="muted">{feed.error.message}</p>
          : !feed.data ? <p className="muted">Loading…</p>
          : !items.length ? <Empty seed="board" text="Nothing here yet. Be the first to post." />
          : <div className="grid grid-2">{items.map((p) => <BoardCard key={p.id} p={p} onOpen={onOpen} mod={moderation?.({ type: 'board-post', id: p.id, title: p.title, text: p.body, authorId: p.author.id, hidden: !!p.hiddenAt })} />)}</div>}
        {feed.hasNextPage && (
          <div className="row" style={{ justifyContent: 'center', marginTop: 'var(--s3)' }}>
            <button className="btn ghost" disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>Show more</button>
          </div>)}
      </div>
    </>
  );
}
