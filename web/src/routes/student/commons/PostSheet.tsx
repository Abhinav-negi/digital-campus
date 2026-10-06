import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import type { components } from '../../../api/schema';
import { Avatar } from '../../../ui/Avatar';
import { Icon } from '../../../ui/Icon';
import { Sheet } from '../../../ui/Sheet';
import { toast } from '../../../ui/Toast';
import { rel, fmt } from '../../../lib/dates';
import { KIND } from './BoardCard';
import { ReportSheet } from './ReportSheet';

type Detail = components['schemas']['BoardPostDetail'];
type Byline = components['schemas']['Byline'];
const MT = { sell: 'Sell', buy: 'Wanted', give: 'Give away', lend: 'Lend' };
const SOLD = { sell: 'sold', buy: 'sold', give: 'given', lend: 'given' } as const;

const Person = ({ u, note, extra }: { u: Byline; note?: string; extra?: ReactNode }) => (
  <div className="row" style={{ alignItems: 'flex-start' }}>
    <Avatar user={u} size="sm" />
    <div className="grow"><b>{u.name}</b> {u.label && <span className="pl">{u.label}</span>}{note && <div className="small">{note}</div>}</div>
    {extra}
  </div>
);
const Eyebrow = ({ children }: { children: ReactNode }) => <div className="eyebrow" style={{ marginBottom: 'var(--s1)' }}>{children}</div>;

function TextForm({ name, ph, label, submit, onSend, area }: { name: string; ph: string; label?: string; submit: string; onSend: (v: string) => void; area?: boolean }) {
  const go = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); onSend(String(new FormData(e.currentTarget).get(name)).trim()); e.currentTarget.reset(); };
  return (
    <form className="stack" onSubmit={go}>
      {label && <div className="field"><label>{label}<input className="input" name={name} required /></label></div>}
      {!label && (area ? <textarea className="input" name={name} required placeholder={ph} /> : <input className="input" name={name} required placeholder={ph} />)}
      <button className="btn primary" type="submit">{submit}</button>
    </form>
  );
}

export function PostSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [reporting, setReporting] = useState(false);
  const key = ['commons', 'post', id];
  const q = useQuery({ queryKey: key, queryFn: () => unwrap(api.GET('/commons/board-posts/{id}', { params: { path: { id } } })) });
  const base = { params: { path: { id } } };
  const act = useMutation({
    mutationFn: (f: () => Promise<unknown>) => f(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commons'] }),
    onError: (e) => toast(e.message),
  });
  const run = (f: () => Promise<unknown>) => act.mutate(f);
  const message = useMutation({
    mutationFn: () => unwrap(api.POST('/commons/board-posts/{id}/message', base)),
    // ponytail: Me > Messages is built in ST-10b; this route 404s until then.
    onSuccess: (c) => { onClose(); toast('Conversation opened in Me › Messages'); nav(`/s/me/messages/${c.id}`); },
    onError: (e) => toast(e.message),
  });

  const p = q.data;
  if (!p) return <Sheet title="Post" onClose={onClose}><p className="muted">{q.error ? q.error.message : 'Loading…'}</p></Sheet>;
  if (reporting) return <ReportSheet postId={id} kind={p.kind} onClose={() => setReporting(false)} />;

  const can = (a: Detail['actions'][number]) => p.actions.includes(a);
  const [kl, ki] = KIND[p.kind];
  const closed = p.status !== 'open';
  const meta = [p.kind === 'market' && p.marketType ? MT[p.marketType] : '', p.price != null ? (p.price === 0 ? 'Free' : `₹${p.price}`) + (p.priceType ? ` · ${p.priceType}` : '') : '', p.condition, p.place,
    p.kind === 'gig' && p.deadline ? `Due ${fmt(p.deadline)}` : '', p.kind === 'found' ? p.holder : ''].filter(Boolean) as string[];
  const setStatus = (status: 'solved' | 'done' | 'sold' | 'given' | 'returned') =>
    run(() => unwrap(api.PATCH('/commons/board-posts/{id}/status', { ...base, body: { status } })));
  const closeStatus = p.kind === 'market' ? SOLD[p.marketType ?? 'sell'] : 'returned';
  const thank = (u: Byline) => p.thanked.includes(u.id) ? <span className="chip">Thanked</span>
    : <button type="button" className="btn sm" onClick={() => run(() => unwrap(api.POST('/commons/thanks', { body: { postId: id, toId: u.id } })))}>Thank</button>;

  return (
    <Sheet title={p.title} onClose={onClose}>
      <div className={`stack k-${p.kind}`}>
        <div className="row">
          <span className="kico"><Icon name={ki} size={16} /></span><span className="kl">{kl}</span>
          {closed && <span className="badge plain">{p.status[0]!.toUpperCase() + p.status.slice(1)}</span>}
          <span className="grow" /><span className="tiny muted">{rel(p.createdAt.slice(0, 10))}</span>
        </div>
        <div className="row"><Person u={p.author} extra={p.author.otherBranch && <span className="chip vio">Other branch</span>} /></div>
        {p.body && <p>{p.body}</p>}
        {meta.length > 0 && <div className="fl">{meta.map((x) => <span key={x} className="chip">{x}</span>)}</div>}
        {p.tags.length > 0 && <div className="fl">{p.tags.map((x) => <span key={x} className="chip">#{x}</span>)}</div>}

        {p.kind === 'ask' && (<>
          <div><Eyebrow>Answers</Eyebrow>
            {p.answers.length ? <div className="list">{p.answers.map((a) => (
              <div key={a.id} className="stack" style={{ gap: 'var(--s1)' }}>
                <Person u={a.author} note={a.body} extra={can('thank') && a.author.id !== p.author.id ? thank(a.author) : undefined} />
                <div className="tiny muted">{rel(a.createdAt.slice(0, 10))}</div>
              </div>))}</div>
              : <p className="small muted">No answers yet. Yours could help the next person too.</p>}
          </div>
          {can('answer') && <TextForm name="body" area ph="Write a public answer" submit="Post answer"
            onSend={(body) => run(() => unwrap(api.POST('/commons/board-posts/{id}/answers', { ...base, body: { body } })))} />}
          {can('solved') && <button type="button" className="btn" onClick={() => setStatus('solved')}><Icon name="check" size={16} /> Mark solved</button>}
          {can('thank') && <p className="small muted">Solved. Tap Thank on whoever helped.</p>}
        </>)}

        {p.kind === 'gig' && (<>
          {p.mine ? <div><Eyebrow>{p.assignee ? 'Assigned to' : 'Interested'}</Eyebrow>
            {p.assignee ? <Person u={p.assignee} />
              : p.interests.length ? <div className="list">{p.interests.map((i) => (
                <Person key={i.id} u={i.user} note={i.note} extra={can('assign') && <button type="button" className="btn sm primary"
                  onClick={() => run(() => unwrap(api.POST('/commons/board-posts/{id}/assign', { ...base, body: { userId: i.user.id } })))}>Assign</button>} />))}</div>
              : <p className="small muted">Nobody yet.</p>}
          </div>
            : can('interest') ? <TextForm name="note" ph="A short note: why you?" submit="I'm interested"
              onSend={(note) => run(() => unwrap(api.POST('/commons/board-posts/{id}/interests', { ...base, body: { note } })))} />
            : closed ? <p className="small muted">This gig is {p.status}.</p> : <span className="chip">You said you are interested</span>}
          {can('done') && <button type="button" className="btn primary" onClick={() => run(() => unwrap(api.POST('/commons/board-posts/{id}/done', base)))}>Mark done + Thank</button>}
          <p className="tiny muted">v1 holds no money. Agree the price, and pay after delivery for small gigs.</p>
        </>)}

        {p.kind === 'found' && (p.mine ? (<>
          <div className="card tint"><div className="tiny muted">Hidden detail (only you see this)</div><b>{p.hiddenDetail}</b></div>
          <div><Eyebrow>Claims</Eyebrow>
            {p.claims.length ? <div className="list">{p.claims.map((c) => (
              <Person key={c.id} u={c.user} note={c.answer} extra={can('confirm') && c.state === 'pending' && <button type="button" className="btn sm primary"
                onClick={() => run(() => unwrap(api.POST('/commons/board-posts/{id}/claims/{claimId}/confirm', { params: { path: { id, claimId: c.id } } })))}>Confirm</button>} />))}</div>
              : <p className="small muted">No claims yet.</p>}
          </div></>)
          : can('claim') ? <TextForm name="answer" label="Describe the hidden detail to prove it is yours" ph="" submit="It's mine"
            onSend={(answer) => run(() => unwrap(api.POST('/commons/board-posts/{id}/claims', { ...base, body: { answer } })))} />
          : !closed && <span className="chip">Claim sent. The finder will confirm.</span>)}

        {can('message') && <>
          <button type="button" className="btn primary" disabled={message.isPending} onClick={() => message.mutate()}>
            <Icon name="chat" size={16} /> {p.kind === 'lost' ? 'I found it' : p.marketType === 'buy' ? 'Message buyer' : p.kind === 'found' ? 'Message the finder' : 'Message seller'}
          </button>
          {p.kind === 'market' && <p className="tiny muted">Meet in a public campus spot. Pay on handover.</p>}
        </>}
        {p.kind !== 'ask' && p.kind !== 'gig' && p.kind !== 'found' && can(closeStatus) && <button type="button" className="btn" onClick={() => setStatus(closeStatus)}><Icon name="check" size={16} /> Mark {closeStatus}</button>}
        {p.kind === 'found' && p.mine && can('returned') && <button type="button" className="btn" onClick={() => setStatus('returned')}><Icon name="check" size={16} /> Mark returned</button>}
        <div><button type="button" className="btn ghost sm" onClick={() => setReporting(true)}>Report</button></div>
      </div>
    </Sheet>
  );
}
