import type { FormEvent } from 'react';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { useTicket, useTicketReply, useTicketState } from './queries';

// AF-01: one ticket thread; the admin replies (→ answered, the student is notified) or closes/reopens it.
export function TicketSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useTicket(id);
  const reply = useTicketReply(id);
  const state = useTicketState(id);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    reply.mutate(String(new FormData(f).get('body')), { onSuccess: () => f.reset(), onError: (er) => toast(er.message) });
  }
  const d = t.data;
  const closed = d?.state === 'closed';
  return (
    <Sheet title={d?.subject ?? 'Ticket'} onClose={onClose}>
      {!d ? <p className="muted">{t.error ? t.error.message : 'Loading…'}</p> : (
        <div className="stack">
          <div className="msgs">
            <div className="msg">{d.body}</div>
            {d.replies.map((r) => <div key={r.id} className={r.fromAdmin ? 'msg mine' : 'msg'}>{r.fromAdmin && <b>You: </b>}{r.body}</div>)}
          </div>
          {!closed && (
            <form className="row" onSubmit={submit}>
              <input className="input grow" name="body" required maxLength={2000} placeholder="Reply" autoComplete="off" aria-label="Reply" />
              <button className="btn primary" type="submit" disabled={reply.isPending}>Send</button>
            </form>)}
          <div className="row">
            <button type="button" className="btn ghost sm" disabled={state.isPending}
              onClick={() => state.mutate(closed ? 'open' : 'closed', { onSuccess: () => { toast(closed ? 'Reopened.' : 'Closed.'); if (!closed) onClose(); }, onError: (er) => toast(er.message) })}>
              {closed ? 'Reopen' : 'Close ticket'}
            </button>
          </div>
        </div>)}
    </Sheet>
  );
}
