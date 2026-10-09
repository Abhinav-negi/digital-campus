import { useState } from 'react';
import { rel } from '../../../lib/dates';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { api, unwrap } from '../../../api/client';
import { Avatar } from '../../../ui/Avatar';
import { Empty } from '../../../ui/Empty';
import { toast } from '../../../ui/Toast';
import { ThreadSheet } from './ThreadSheet';

const KEY = ['commons', 'conversations'];

export function Messages() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const open = /^messages\/([^/]+)/.exec(useParams()['*'] ?? '')?.[1]; // deep link /s/me/messages/:id
  const [pick, setPick] = useState<string>();
  const list = useQuery({ queryKey: KEY, queryFn: () => unwrap(api.GET('/commons/conversations')) });
  const respond = useMutation({
    mutationFn: (v: { id: string; state: 'accepted' | 'ignored' }) => unwrap(api.POST('/commons/conversations/{id}/respond', { params: { path: { id: v.id } }, body: { state: v.state } })),
    onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: KEY }); toast(v.state === 'accepted' ? 'Accepted. You can chat now.' : 'Ignored.'); },
    onError: (e) => toast(e.message),
  });
  if (!list.data) return <p className="muted">{list.error ? list.error.message : 'Loading…'}</p>;
  const { incoming, conversations, outgoing } = list.data;
  const id = pick ?? open;
  const cur = id ? conversations.find((c) => c.id === id) : undefined;
  const close = () => { setPick(undefined); if (open) nav('/s/me', { replace: true }); };

  return (
    <div className="stack">
      {incoming.length > 0 && <div className="card"><div className="eyebrow" style={{ marginBottom: 'var(--s1)' }}>Requests for you</div><div className="list">
        {incoming.map((c) => (
          <div key={c.id} className="stack" style={{ gap: 'var(--s1)' }}>
            <div className="row"><Avatar user={c.with} size="sm" /><b>{c.with.name}</b><span className="small muted">{rel(c.lastAt.slice(0, 10))}</span></div>
            <div className="small">{c.note}</div>
            <div className="row">
              <button type="button" className="btn sm primary" disabled={respond.isPending} onClick={() => respond.mutate({ id: c.id, state: 'accepted' })}>Accept</button>
              <button type="button" className="btn sm" disabled={respond.isPending} onClick={() => respond.mutate({ id: c.id, state: 'ignored' })}>Ignore</button>
            </div>
          </div>))}
      </div></div>}
      {conversations.length > 0 && <div className="card"><div className="eyebrow" style={{ marginBottom: 'var(--s1)' }}>Conversations</div><div className="list">
        {conversations.map((c) => (
          <div key={c.id} className="row" role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => setPick(c.id)} onKeyDown={(e) => e.key === 'Enter' && setPick(c.id)}>
            <Avatar user={c.with} size="sm" />
            <div className="grow"><b>{c.with.name}</b>
              {c.post && <div className="tiny muted">About: {c.post.title}</div>}
              <div className="small muted clamp">{c.lastMessage ?? c.note}</div></div>
          </div>))}
      </div></div>}
      {outgoing.length > 0 && <p className="small muted">Waiting for a reply from {outgoing.map((c) => c.with.name).join(', ')}.</p>}
      {!incoming.length && !conversations.length && !outgoing.length && <Empty seed="hello" text="No messages yet. Ask someone from People." />}
      {id && (cur ? <ThreadSheet id={cur.id} who={cur.with.name} about={cur.post?.title} onClose={close} /> : open && <ThreadSheet id={open} who="Conversation" onClose={close} />)}
    </div>
  );
}
