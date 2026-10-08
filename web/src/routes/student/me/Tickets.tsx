import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import { Badge } from '../../../ui/Badge';
import { FormSheet } from '../../../ui/FormSheet';
import { Sheet } from '../../../ui/Sheet';
import { toast } from '../../../ui/Toast';

type Cat = 'account' | 'class' | 'attendance' | 'commons' | 'bug' | 'other';
const CATS: readonly (readonly [Cat, string])[] = [['account', 'Account'], ['class', 'My class'], ['attendance', 'Attendance'], ['commons', 'Commons'], ['bug', 'Something is broken'], ['other', 'Other']];
const KEY = ['tickets', 'mine'];

function TicketSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const key = ['tickets', id];
  const t = useQuery({ queryKey: key, queryFn: () => unwrap(api.GET('/tickets/{id}', { params: { path: { id } } })) });
  const reply = useMutation({
    mutationFn: (body: string) => unwrap(api.POST('/tickets/{id}/replies', { params: { path: { id } }, body: { body } })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: KEY }); },
    onError: (e) => toast(e.message),
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    reply.mutate(String(new FormData(f).get('body')), { onSuccess: () => f.reset() });
  }
  const d = t.data;
  return (
    <Sheet title={d?.subject ?? 'Ticket'} onClose={onClose}>
      {!d ? <p className="muted">{t.error ? t.error.message : 'Loading…'}</p> : (
        <div className="stack">
          <div className="msgs">
            <div className="msg mine">{d.body}</div>
            {d.replies.map((r) => <div key={r.id} className={r.fromAdmin ? 'msg' : 'msg mine'}>{r.fromAdmin && <b>Admin: </b>}{r.body}</div>)}
          </div>
          {d.state === 'closed' ? <p className="small muted">This ticket is closed.</p> : (
            <form className="row" onSubmit={submit}>
              <input className="input grow" name="body" required maxLength={2000} placeholder="Reply" autoComplete="off" aria-label="Reply" />
              <button className="btn primary" type="submit" disabled={reply.isPending}>Send</button>
            </form>)}
        </div>)}
    </Sheet>
  );
}

// "Need help?" card + My tickets (ARCH D6).
export function Tickets() {
  const qc = useQueryClient();
  const [form, setForm] = useState(false);
  const [open, setOpen] = useState<string>();
  const mine = useQuery({ queryKey: KEY, queryFn: () => unwrap(api.GET('/tickets/mine')) });
  const items = mine.data?.items ?? [];
  return (
    <div className="stack">
      <div className="card row between">
        <div><b>Need help?</b><div className="small muted">Send a message to the campus admin. Replies show up below.</div></div>
        <button type="button" className="btn primary" onClick={() => setForm(true)}>Contact admin</button>
      </div>
      {items.length > 0 && <div className="card"><div className="eyebrow" style={{ marginBottom: 'var(--s1)' }}>My tickets</div><div className="list">
        {items.map((t) => (
          <div key={t.id} className="row" role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => setOpen(t.id)} onKeyDown={(e) => e.key === 'Enter' && setOpen(t.id)}>
            <div className="grow"><b>{t.subject}</b><div className="tiny muted">{CATS.find((c) => c[0] === t.category)?.[1]}</div></div>
            <Badge kind={t.state === 'answered' ? 'open' : t.state === 'closed' ? 'focus' : 'warn'}>{t.state === 'answered' ? 'Answered' : t.state === 'closed' ? 'Closed' : 'Waiting'}</Badge>
          </div>))}
      </div></div>}
      {mine.error && <p className="muted">{mine.error.message}</p>}
      {form && <FormSheet title="Contact admin" label="Send" onClose={() => setForm(false)}
        fields={[
          { name: 'category', label: 'Category', type: 'select', options: CATS, value: 'other' },
          { name: 'subject', label: 'Subject', req: true },
          { name: 'body', label: 'Message', type: 'textarea', req: true },
        ]}
        onSubmit={async (v) => {
          await unwrap(api.POST('/tickets', { body: { category: v.category as Cat, subject: String(v.subject), body: String(v.body) } }));
          qc.invalidateQueries({ queryKey: KEY });
          toast('Sent to the admin.');
        }} />}
      {open && <TicketSheet id={open} onClose={() => setOpen(undefined)} />}
    </div>
  );
}
