import { useEffect, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../../../api/client';
import type { components } from '../../../../api/schema';
import { Avatar } from '../../../../ui/Avatar';
import { Badge, Chip } from '../../../../ui/Badge';
import { Empty } from '../../../../ui/Empty';
import { FormSheet } from '../../../../ui/FormSheet';
import { Icon } from '../../../../ui/Icon';
import { Sheet } from '../../../../ui/Sheet';
import { toast } from '../../../../ui/Toast';
import { ReportSheet } from '../ReportSheet';

type Card = components['schemas']['PersonCard'];
type Avail = Card['availability'];
const AV: [Avail | '', string][] = [['', 'All'], ['open', 'Open'], ['questions', 'Questions only'], ['focus', 'Focus']];
const AV_LABEL: Record<Avail, string> = { open: 'Open', questions: 'Questions only', focus: 'Focus' };
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const place = (p: Pick<Card, 'label' | 'branch' | 'year'>) => p.label ?? [p.branch?.code, p.year && `Year ${p.year}`].filter(Boolean).join(' · ');

export function People() {
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [av, setAv] = useState<Avail | ''>('');
  const [branchId, setBranchId] = useState('');
  const [year, setYear] = useState('');
  const [helps, setHelps] = useState(false);
  const [openId, setOpenId] = useState<string>();
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(t); }, [q]);

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => unwrap(api.GET('/branches')) });
  const feed = useInfiniteQuery({
    queryKey: ['commons', 'people', dq, av, branchId, year, helps],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => unwrap(api.GET('/commons/people', {
      params: { query: {
        q: dq || undefined, availability: av || undefined, branchId: branchId || undefined,
        year: year ? Number(year) : undefined, helpsJuniors: helps ? 'true' : undefined, cursor: pageParam, limit: 20,
      } },
    })),
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <div className="stack">
        <div className="bfilters" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
          <input className="input" type="search" placeholder="Search by name or skill" aria-label="Search people" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" aria-label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">All branches</option>
            {branches.data?.items.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
          </select>
          <select className="input" aria-label="Year" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All years</option>
            {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
          </select>
        </div>
        <div className="fl">
          {AV.map(([k, l]) => <Chip key={k} on={av === k} onClick={() => setAv(k)}>{l}</Chip>)}
          <Chip on={helps} onClick={() => setHelps(!helps)}>Happy to help juniors</Chip>
        </div>
      </div>
      <div style={{ marginTop: 'var(--s3)' }}>
        {feed.error ? <p className="muted">{feed.error.message}</p>
          : !feed.data ? <p className="muted">Loading…</p>
          : !items.length ? <Empty seed="search" text="No one matches. Try another skill." />
          : <div className="grid grid-2">{items.map((u) => (
            <div key={u.id} className="card click" role="button" tabIndex={0} onClick={() => setOpenId(u.id)}
              onKeyDown={(e) => e.key === 'Enter' && setOpenId(u.id)}>
              <div className="row">
                <Avatar user={u} />
                <div className="grow"><b>{u.name}</b><div className="small muted">{place(u)}</div></div>
                <Badge kind={u.availability}>{AV_LABEL[u.availability]}</Badge>
              </div>
              <p className="small" style={{ margin: 'var(--s2) 0' }}>{u.headline}</p>
              <div className="fl">
                {u.helpsJuniors && <Chip tone="vio">Helps juniors</Chip>}
                {u.skills.slice(0, 3).map((s) => <Chip key={s}>{s}</Chip>)}
              </div>
            </div>))}</div>}
        {feed.hasNextPage && (
          <div className="row" style={{ justifyContent: 'center', marginTop: 'var(--s3)' }}>
            <button className="btn" disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>Show more</button>
          </div>)}
      </div>
      {openId && <PersonSheet id={openId} onClose={() => setOpenId(undefined)} />}
    </>
  );
}

const LINKS = { github: ['github', 'github.com/'], leetcode: ['code', 'leetcode.com/u/'], linkedin: ['link', 'linkedin.com/in/'] } as const;
const REASONS = ['Spam', 'Unsafe or prohibited', 'Harassment', 'Other'] as const;

function PersonSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'view' | 'ask' | 'report'>('view');
  const { data: p, error } = useQuery({ queryKey: ['commons', 'profile', id], queryFn: () => unwrap(api.GET('/commons/profiles/{userId}', { params: { path: { userId: id } } })) });

  const block = useMutation({
    mutationFn: () => unwrap(api.POST('/commons/blocks', { body: { userId: id } })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commons'] }); toast('Blocked.'); onClose(); },
    onError: (e) => toast(e.message),
  });
  if (!p) return <Sheet onClose={onClose}>{error ? <p className="muted">{error.message}</p> : <p className="muted">Loading…</p>}</Sheet>;
  const first = p.name.split(' ')[0]!;

  if (mode === 'ask')
    return <FormSheet title={`Ask ${first}`} label="Send request" onClose={() => setMode('view')}
      fields={[{ name: 'note', label: 'Add a short note', type: 'textarea', req: true, ph: 'Saw you know React; would you look at my project?' }]}
      onSubmit={async (v) => {
        await unwrap(api.POST('/commons/conversations', { body: { toId: id, note: String(v.note).trim() } }));
        qc.invalidateQueries({ queryKey: ['commons'] });
        toast('Request sent');
        onClose();
      }} />;
  if (mode === 'report')
    return <ReportSheet title="Report this person" targetType="profile" targetId={id} reasons={REASONS} onClose={() => setMode('view')} />;

  const ask = p.self ? <Chip>This is you</Chip>
    : p.availability === 'focus' ? <p className="small muted">In focus mode{p.focusUntil && ` until ${day(p.focusUntil)}`}</p>
    : p.conversation ? <Chip>{p.conversation.state === 'accepted' ? 'You are connected' : p.conversation.fromMe ? 'Request sent' : 'They sent you a request'}</Chip>
    : p.canAsk ? <button type="button" className="btn primary" onClick={() => setMode('ask')}>Ask</button> : null;
  const links = (Object.keys(LINKS) as (keyof typeof LINKS)[]).filter((k) => p.links[k]);
  const other = p.links.other.filter((u) => /^https?:\/\//.test(u));

  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <div className="row">
          <Avatar user={p} size="lg" />
          <div className="grow">
            <h3>{p.name}</h3>
            <div className="small muted">{place(p)}</div>
            <div className="fl" style={{ marginTop: 'var(--s1)' }}>
              <Badge kind={p.availability}>{AV_LABEL[p.availability]}</Badge>
              {p.helpsJuniors && <Chip tone="vio">Happy to help juniors</Chip>}
            </div>
          </div>
        </div>
        <p className="small muted">Helped {p.track.helped} · {p.track.gigsDone} gigs done · {p.track.projectsShipped} projects shipped</p>
        <p>{p.headline}</p>
        <div className="fl">{p.skills.map((s) => <Chip key={s}>{s}</Chip>)}</div>
        {(links.length > 0 || other.length > 0) && (
          <div className="stack">
            {links.map((k) => (
              <a key={k} className="row" href={`https://${LINKS[k][1]}${encodeURIComponent(p.links[k])}`} target="_blank" rel="noopener noreferrer">
                <Icon name={LINKS[k][0]} size={18} /> <span>{k[0]!.toUpperCase() + k.slice(1)}<span className="small muted"> · {p.links[k]}</span></span>
              </a>))}
            {other.map((u) => <a key={u} className="row" href={u} target="_blank" rel="noopener noreferrer"><Icon name="link" size={18} /> <span>{u}</span></a>)}
          </div>)}
        {p.projects.length > 0 && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 'var(--s1)' }}>Working on</div>
            <div className="fl">{p.projects.map((x) => <Chip key={x.id} tone="vio">{x.title}</Chip>)}</div>
          </div>)}
        <div>{ask}</div>
        {!p.self && (
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => setMode('report')}><Icon name="flag" size={16} /> Report</button>
            <button type="button" className="btn ghost" disabled={block.isPending} onClick={() => block.mutate()}>Block</button>
          </div>)}
      </div>
    </Sheet>
  );
}
