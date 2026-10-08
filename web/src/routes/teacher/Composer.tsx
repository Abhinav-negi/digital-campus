import { useState, type FormEvent } from 'react';
import { Sheet } from '../../ui/Sheet';
import { Tabs } from '../../ui/Tabs';
import { toast } from '../../ui/Toast';
import { useCreatePost, useTeachingClasses } from './queries';

const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv'); };

// PROTO teacher.html:427-463 postSheet. `classId` pre-ticks one class (class header); otherwise none is ticked.
export function Composer({ classId, onClose }: { classId?: string; onClose: () => void }) {
  const classes = useTeachingClasses().data ?? [];
  const create = useCreatePost();
  const [kind, setKind] = useState<'announcement' | 'assignment'>('announcement');
  const [picked, setPicked] = useState<string[]>(classId ? [classId] : []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get('title')).trim(), dueAt = String(fd.get('due') ?? '');
    if (!title) return toast('Add a title first');
    if (!picked.length) return toast('Pick at least one class');
    if (kind === 'assignment' && !dueAt) return toast('Pick a due date');
    const f = fd.get('file');
    try {
      await create.mutateAsync({ kind, title, body: String(fd.get('body')).trim(), classIds: picked, dueAt: kind === 'assignment' ? dueAt : undefined, file: f instanceof File && f.size ? f : null });
      toast(picked.length === 1 ? 'Posted to 1 class' : `Posted to ${picked.length} classes`);
      onClose();
    } catch (err) { toast(err instanceof Error ? err.message : 'Something went wrong. Try again.'); }
  }

  return (
    <Sheet title="New post" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Tabs tabs={[['announcement', 'Announcement'], ['assignment', 'Assignment']]} value={kind} onChange={setKind} />
        {kind === 'assignment' && <div className="field"><label htmlFor="pdue">Due date</label><input className="input" type="date" id="pdue" name="due" min={addDays(0)} defaultValue={addDays(7)} /></div>}
        <div className="field"><label htmlFor="ptitle">Title</label><input className="input" id="ptitle" name="title" placeholder="What is this about?" /></div>
        <div className="field"><label htmlFor="pbody">Message</label><textarea className="input" id="pbody" name="body" /></div>
        <div className="field"><label htmlFor="pfile">Attachment (optional)</label><input className="input" type="file" id="pfile" name="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.zip" /></div>
        <div className="field"><label>Send to</label><div className="stack" style={{ gap: 'var(--s1)' }}>
          {classes.map((c) => (
            <label key={c.id} className="chk"><input type="checkbox" checked={picked.includes(c.id)}
              onChange={(e) => setPicked(e.target.checked ? [...picked, c.id] : picked.filter((x) => x !== c.id))} />
              <span><b>{c.name}</b><br /><span className="tiny muted">{c.counts.students} {c.counts.students === 1 ? 'student' : 'students'}</span></span></label>
          ))}</div></div>
        <p className="tiny muted">Replies are off. Questions go to the class CR.</p>
        <div className="actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary" disabled={create.isPending}>Post</button></div>
      </form>
    </Sheet>
  );
}
