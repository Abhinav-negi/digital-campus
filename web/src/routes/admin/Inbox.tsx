import { useState } from 'react';
import { Badge, type BadgeKind } from '../../ui/Badge';
import { Tabs } from '../../ui/Tabs';
import { Empty } from '../../ui/Empty';
import { toast } from '../../ui/Toast';
import { TicketSheet } from './TicketSheet';
import { useInbox, useOverview, useReportAction, type InboxState, type InboxType } from './queries';

const TYPES: [InboxType, string][] = [['all', 'All'], ['tickets', 'Tickets'], ['reports', 'Reports']];
const STATES: [InboxState | 'any', string][] = [['any', 'Any'], ['open', 'Open'], ['answered', 'Answered'], ['closed', 'Closed'], ['hidden', 'Hidden'], ['warned', 'Warned'], ['dismissed', 'Dismissed']];
const KIND: Record<string, BadgeKind> = { open: 'warn', answered: 'open', closed: 'focus', hidden: 'danger', warned: 'questions', dismissed: 'focus' };
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

// AF-01: overview stats + merged tickets/reports inbox (ARCH D6, PROTO admin.html:86-99).
export function Component() {
  const [type, setType] = useState<InboxType>('all');
  const [state, setState] = useState<InboxState | 'any'>('any');
  const [open, setOpen] = useState<string>();
  const ov = useOverview();
  const inbox = useInbox(type, state === 'any' ? undefined : state);
  const act = useReportAction();
  const o = ov.data;
  const stats: [string, number | undefined][] = [
    ['Open tickets', o?.openTickets], ['Open reports', o?.openReports], ['Pending invites', o?.pendingInvites],
    ['Classes without timetable', o?.classesWithoutTimetable.length],
  ];
  return (
    <>
      <div className="page-head"><div><h1>Inbox</h1><p className="muted">Tickets from students and teachers, and reported Commons items. Every action is logged.</p></div></div>
      <div className="card row">
        {stats.map(([l, n]) => <div key={l} className="grow"><b>{n ?? '–'}</b><div className="tiny muted">{l}</div></div>)}
      </div>
      {ov.error && <p className="muted">{ov.error.message}</p>}
      <div className="row" style={{ flexWrap: 'wrap', margin: 'var(--s2) 0' }}>
        <Tabs tabs={TYPES} value={type} onChange={setType} />
        <Tabs tabs={STATES} value={state} onChange={setState} />
      </div>
      {inbox.error && <p className="muted">{inbox.error.message}</p>}
      {inbox.data && !inbox.data.items.length && <Empty text="Nothing here." />}
      <div className="list">
        {inbox.data?.items.map((it) => it.type === 'ticket' ? (
          <div key={it.id} className="row-item" role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => setOpen(it.id)} onKeyDown={(e) => e.key === 'Enter' && setOpen(it.id)}>
            <div className="grow"><h4>{it.subject} <Badge kind={KIND[it.state]!}>{cap(it.state)}</Badge></h4>
              <p className="muted tiny">Ticket · {it.category} · {it.from.name} · {when(it.createdAt)}</p></div>
          </div>
        ) : (
          <div key={it.id} className="row-item">
            <div className="grow"><h4>{cap(it.targetType)} <span className="muted tiny">{it.targetId}</span> <Badge kind={KIND[it.state]!}>{cap(it.state)}</Badge></h4>
              <p className="small">{it.reason}</p><p className="muted tiny">Reported by {it.from.name} · {when(it.createdAt)}</p></div>
            {it.state === 'open' && <div className="acts">
              {(['hide', 'warn', 'delete', 'dismiss'] as const).map((a) => (
                <button key={a} type="button" className={`btn sm${a === 'dismiss' ? ' ghost' : ''}`} disabled={act.isPending}
                  onClick={() => { if (a !== 'delete' || confirm('Delete the reported item for good?')) act.mutate({ id: it.id, action: a }, { onSuccess: () => toast(`${cap(a)} done.`), onError: (e) => toast(e.message) }); }}>{cap(a)}</button>))}
            </div>}
          </div>))}
      </div>
      {open && <TicketSheet id={open} onClose={() => setOpen(undefined)} />}
    </>
  );
}
