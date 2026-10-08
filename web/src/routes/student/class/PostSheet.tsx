import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import type { components } from '../../../api/schema';
import { Chip } from '../../../ui/Badge';
import { Icon } from '../../../ui/Icon';
import { Sheet } from '../../../ui/Sheet';
import { AddToBoardSheet } from './edit/BoardForms';

export type Post = components['schemas']['Post'];
export const rel = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 6e4));
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

/** PROTO postSheet (student.html:551): opening marks the post seen; the CR can add it to the board. */
export function PostSheet({ classId, post, isCr, onClose }: { classId: string; post: Post; isCr: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [board, setBoard] = useState(false);
  useEffect(() => {
    if (post.seen) return;
    void api.POST('/posts/{id}/seen', { params: { path: { id: post.id } } }).then((r) => {
      if (!r.error) { void qc.invalidateQueries({ queryKey: ['classes', classId, 'posts'] }); void qc.invalidateQueries({ queryKey: ['me', 'today'] }); }
    });
  }, [post.id, post.seen, classId, qc]);
  if (board) return <AddToBoardSheet classId={classId} post={post} onClose={() => setBoard(false)} />;
  return (
    <Sheet title={post.title} onClose={onClose}>
      <div className="stack">
        <div className="small muted">{post.author.name} · {post.kind} · {rel(post.createdAt)}</div>
        <p>{post.body}</p>
        {post.dueAt && <div><Chip tone="due">Due {new Date(post.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Chip></div>}
        {post.fileUrl && <a className="btn" href={post.fileUrl} target="_blank" rel="noreferrer"><Icon name="file" size={16} /> {post.fileName ?? 'Attachment'}</a>}
        {isCr && <button type="button" className="btn" onClick={() => setBoard(true)}><Icon name="plus" size={16} /> Add to board</button>}
      </div>
    </Sheet>
  );
}
