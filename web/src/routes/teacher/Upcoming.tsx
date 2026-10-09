import { useState, type FormEvent } from 'react';
import { Badge } from '../../ui/Badge';
import { Empty } from '../../ui/Empty';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { useAddReminder, useUpcoming } from './queries';

const KIND = { exam: ['questions', 'Exam'], deadline: ['danger', 'Deadline'], assignment: ['open', 'Assignment'], reminder: ['focus', 'Private reminder'] } as const;
const iso = (d: Date) => d.toLocaleDateString('sv');
const dayNum = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;
const weekIdx = (s: string) => Math.floor((dayNum(s) + 3) / 7); // epoch day 0 was a Thursday; +3 aligns weeks to Monday

// PROTO teacher.html:440-463, 473-483.
export function Component() {
  const { data: items, error } = useUpcoming();
  const [adding, setAdding] = useState(false);
  const today = iso(new Date()), cur = weekIdx(today);
  const groups = new Map<number, NonNullable<typeof items>>();
  items?.forEach((i) => groups.set(weekIdx(i.date), [...(groups.get(weekIdx(i.date)) ?? []), i]));
  const label = (w: number) => (w <= cur ? 'This week' : w === cur + 1 ? 'Next week' : `In ${w - cur} weeks`);
  const rel = (d: string) => { const n = dayNum(d) - dayNum(today); return n === 1 ? 'tomorrow' : `in ${n} days`; };

  return (
    <>
      <div className="page-head"><div><div className="eyebrow">Next 30 days</div><h1>Upcoming</h1><p className="muted">Exams, deadlines and assignments across your classes.</p></div>
        <button type="button" className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" /> Add private reminder</button></div>
      {error && <p className="muted">{error.message}</p>}
      {items && !items.length && <Empty seed="Relax" text="Nothing due in the next 30 days." />}
      {[...groups].map(([w, list]) => (
        <div key={w}><h3 className="week">{label(w)}</h3><div className="card"><div className="list">{list.map((i) => {
          const d = new Date(i.date + 'T00:00'), [b, l] = KIND[i.kind];
          return (
            <div key={i.ref} className="item"><div className="dateblk"><b>{d.getDate()}</b><span className="tiny muted">{d.toLocaleDateString('en-GB', { month: 'short' })}</span></div>
              <div className="grow"><h4>{i.title}</h4><div className="tiny muted">{i.private ? 'Only you' : i.className ?? 'Class'} · {d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div></div>
              {i.date === today ? <Badge kind="warn" plain>Today</Badge> : <span className="tiny muted">{rel(i.date)}</span>}<Badge kind={b}>{l}</Badge></div>
          );
        })}</div></div></div>
      ))}
      {adding && <Reminder today={today} onClose={() => setAdding(false)} />}
    </>
  );
}

function Reminder({ today, onClose }: { today: string; onClose: () => void }) {
  const add = useAddReminder();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget), title = String(fd.get('title')).trim(), date = String(fd.get('date'));
    if (!title) return toast('Add a title');
    if (!date || date < today) return toast('Pick today or a later date');
    try { await add.mutateAsync({ title, date }); toast('Reminder added'); onClose(); }
    catch (err) { toast(err instanceof Error ? err.message : 'Something went wrong. Try again.'); }
  }
  const tomorrow = iso(new Date(Date.now() + 864e5));
  return (
    <Sheet title="Private reminder" onClose={onClose}>
      <p className="muted small" style={{ marginBottom: 'var(--s2)' }}>Only you can see this.</p>
      <form className="stack" onSubmit={submit}>
        <div className="field"><label htmlFor="rt">Title</label><input className="input" id="rt" name="title" placeholder="e.g. Set the question paper" /></div>
        <div className="field"><label htmlFor="rd">Date</label><input className="input" type="date" id="rd" name="date" min={today} defaultValue={tomorrow} /></div>
        <div className="actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary" disabled={add.isPending}>Add reminder</button></div>
      </form>
    </Sheet>
  );
}
