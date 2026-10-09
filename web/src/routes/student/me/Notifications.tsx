import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rel } from '../../../lib/dates';
import { useNavigate } from 'react-router';
import { api, unwrap } from '../../../api/client';
import { Empty } from '../../../ui/Empty';
import { toast } from '../../../ui/Toast';

const KEY = ['me', 'notifications'];

/** `sheet`: inside a Sheet (it supplies the heading); `onNavigate` fires when a row's link is followed. */
export function Notifications({ sheet, onNavigate }: { sheet?: boolean; onNavigate?: () => void } = {}) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const list = useQuery({ queryKey: KEY, queryFn: () => unwrap(api.GET('/me/notifications', { params: { query: { limit: 30 } } })) });
  const read = useMutation({
    mutationFn: (body: { ids: string[] } | { all: true }) => unwrap(api.POST('/me/notifications/read', { body })),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: KEY }), qc.invalidateQueries({ queryKey: ['notifications', 'unread'] })]),
    onError: (e) => toast(e.message),
  });
  if (!list.data) return <p className="muted">{list.error ? list.error.message : 'Loading…'}</p>;
  const items = list.data.items;
  return (
    <div className="section">
      <div className="row between">
        {sheet ? <span /> : <h3>Notifications</h3>}
        <button type="button" className="btn sm" disabled={!list.data.unreadCount || read.isPending} onClick={() => read.mutate({ all: true })}>Mark all read</button>
      </div>
      <div className="card">{items.length ? <div className="list">{items.map((n) => (
        <button key={n.id} type="button" className="row" style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: n.link ? 'pointer' : 'default' }}
          onClick={() => { if (!n.read) read.mutate({ ids: [n.id] }); if (n.link) { nav(n.link); onNavigate?.(); } }}>
          {n.read ? <span style={{ width: 'var(--s1)' }} /> : <span className="unread" />}
          <div className={n.read ? 'grow muted' : 'grow'}>{n.text}</div>
          <span className="small muted">{rel(n.createdAt.slice(0, 10))}</span>
        </button>))}</div> : <Empty text="No notifications." />}</div>
    </div>
  );
}
