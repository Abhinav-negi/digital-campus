import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import { usePoll } from '../../../api/hooks';
import { useMe } from '../../../api/hooks';
import { Icon } from '../../../ui/Icon';
import { Sheet } from '../../../ui/Sheet';
import { toast } from '../../../ui/Toast';

// PROTO threadSheet (student.html:509-516). Polls every 5s (CM-06).
export function ThreadSheet({ id, who, about, onClose }: { id: string; who: string; about?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const meId = useMe().data?.user.id;
  const key = ['commons', 'conversations', id, 'messages'];
  // ponytail: newest-first paging isn't offered, so read the first 100 messages; follow nextCursor if threads outgrow that.
  const msgs = useQuery({ queryKey: key, queryFn: () => unwrap(api.GET('/commons/conversations/{id}/messages', { params: { path: { id }, query: { limit: 100 } } })) });
  usePoll(key, 5000);
  const send = useMutation({
    mutationFn: (body: string) => unwrap(api.POST('/commons/conversations/{id}/messages', { params: { path: { id } }, body: { body } })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['commons', 'conversations'], exact: true }); },
    onError: (e) => toast(e.message),
  });
  const box = useRef<HTMLDivElement>(null);
  const n = msgs.data?.items.length;
  useEffect(() => { box.current && (box.current.scrollTop = box.current.scrollHeight); }, [n]);
  const [text, setText] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    send.mutate(body, { onSuccess: () => setText('') });
  }
  return (
    <Sheet title={who} onClose={onClose}>
      {about && <div className="card tint small">About: <b>{about}</b></div>}
      <div className="msgs" ref={box}>
        {msgs.error ? <p className="muted">{msgs.error.message}</p> : msgs.data?.items.map((m) => <div key={m.id} className={m.senderId === meId ? 'msg mine' : 'msg'}>{m.body}</div>)}
      </div>
      <form className="row" onSubmit={submit}>
        <input className="input grow" value={text} onChange={(e) => setText(e.target.value)} required maxLength={2000} placeholder="Write a message" autoComplete="off" aria-label="Message" />
        <button className="btn primary" type="submit" aria-label="Send" disabled={send.isPending}><Icon name="send" /></button>
      </form>
    </Sheet>
  );
}
