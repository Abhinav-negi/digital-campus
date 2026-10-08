import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import { Empty } from '../../../ui/Empty';
import { Chip } from '../../../ui/Badge';
import { Icon } from '../../../ui/Icon';
import { PostSheet, rel, type Post } from './PostSheet';

/** PROTO bPosts (student.html:226): newest first, New/Seen state, due chip. */
export function Posts({ classId, isCr }: { classId: string; isCr: boolean }) {
  const q = useQuery({ queryKey: ['classes', classId, 'posts'], queryFn: () => unwrap(api.GET('/classes/{id}/posts', { params: { path: { id: classId } } })) });
  const [open, setOpen] = useState<Post>();
  const items = q.data?.items ?? [];
  if (!q.data) return null;
  if (!items.length) return <Empty text="No posts from teachers yet." />;
  return (
    <>
      <div className="stack">{items.map((p) => (
        <button key={p.id} type="button" className="card click" style={{ textAlign: 'left', width: '100%' }} onClick={() => setOpen(p)}>
          <div className="row"><div className="grow"><b>{p.author.name}</b><div className="small muted">{p.kind} · {rel(p.createdAt)}</div></div>
            {p.seen ? <span className="small muted row" style={{ gap: 'var(--s0)' }}><Icon name="check" size={16} /> Seen</span> : <Chip tone="vio">New</Chip>}</div>
          <h4 style={{ marginTop: 'var(--s2)' }}>{p.title}</h4>
          <p className="small muted clamp">{p.body}</p>
          {p.dueAt && <div style={{ marginTop: 'var(--s1)' }}><Chip tone="due">Due {new Date(p.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Chip></div>}
        </button>))}
      </div>
      {open && <PostSheet classId={classId} post={open} isCr={isCr} onClose={() => setOpen(undefined)} />}
    </>
  );
}
