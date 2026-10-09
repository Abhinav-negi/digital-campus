import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useMe } from '../../api/hooks';
import { ClashBanner } from './ClashBanner';
import { SessionActions } from './SessionActions';
import { Badge } from '../../ui/Badge';
import { Empty } from '../../ui/Empty';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { useAddReminder, useMySchedule, useTeachingClasses, useUpcoming } from './queries';

const KIND = { exam: ['questions', 'Exam'], deadline: ['danger', 'Deadline'], assignment: ['open', 'Assignment'], reminder: ['focus', 'Private reminder'] } as const;
const iso = (d: Date) => d.toLocaleDateString('sv');
const dayNum = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;
const weekIdx = (s: string) => Math.floor((dayNum(s) + 3) / 7); // epoch day 0 was a Thursday; +3 aligns weeks to Monday

// PROTO teacher.html:440-463, 473-483.
export function Component() {
  const { data: items, error } = useUpcoming();
  const [adding, setAdding] = useState(false);
  const today = iso(new Date()), cur = weekIdx(today);
  const { data: me } = useMe();
  const { data: days } = useMySchedule(me?.user.id ?? '', today, iso(new Date(Date.now() + 13 * 864e5)));
  const { data: cls } = useTeachingClasses();
  const focus = useSearchParams()[0].get('date'); // clash notification deep link: /t/upcoming?date=YYYY-MM-DD
  useEffect(() => { if (days) document.getElementById(`day-${focus}`)?.scrollIntoView({ block: 'start' }); }, [days, focus]);
  const groups = new Map<number, NonNullable<typeof items>>();
  items?.forEach((i) => groups.set(weekIdx(i.date), [...(groups.get(weekIdx(i.date)) ?? []), i]));
  const label = (w: number) => (w <= cur ? 'This week' : w === cur + 1 ? 'Next week' : `In ${w - cur} weeks`);
  const rel = (d: string) => { const n = dayNum(d) - dayNum(today); return n === 1 ? 'tomorrow' : `in ${n} days`; };

  return (
    <>
      <div className="page-head"><div><div className="eyebrow">Next 30 days</div><h1>Upcoming</h1><p className="muted">Exams, deadlines and assignments across your classes.</p></div>
        <button type="button" className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" /> Add private reminder</button></div>
      {error && <p className="muted">{error.message}</p>}
      {days && days.length > 0 && (
        <div><h3 className="week">Your classes · next 14 days</h3>{days.map(({ date, items: ss }) => (
          <div key={date} id={`day-${date}`} className="card" style={{ marginBottom: 'var(--s2)', ...(date === focus && { outline: '2px solid var(--danger, currentColor)' }) }}>
            <div className="tiny muted" style={{ padding: 'var(--s2) var(--s2) 0' }}>{date === today ? 'Today' : rel(date)} · {new Date(date + 'T00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
            <div className="list">{ss.map((s) => {
              const c = s.change, start = c?.start ?? s.start, end = c?.end ?? s.end, orig = c?.kind === 'moved' ? c.date : date, clash = !s.off && c?.kind !== 'cancelled' && s.clashWith.length > 0;
              return (
                <div key={s.id} className="item"><div className="dateblk"><b>{start}</b><span className="tiny muted">{end}</span></div>
                  <div className="grow"><h4>{s.subject?.name ?? s.title}{clash && <> <Badge kind="clash" /></>}</h4>
                    <div className="tiny muted">{cls?.find((c) => c.id === s.classId)?.name} {s.room && `· ${s.room}`}</div>
                    {c && <div className="tiny muted">{c.kind === 'cancelled' ? 'Cancelled' : c.kind === 'moved' ? (s.off ? `Moved to ${c.movedToDate ?? date}` : 'Moved here') : ''}{c.note && ` · ${c.note}`}</div>}
                    <ClashBanner s={s} date={orig} mine={s.teacher?.id === me?.user.id} /></div>
                  {!s.off && c?.kind !== 'cancelled' && !clash && <SessionActions s={s} date={orig} />}</div>
              );
            })}</div></div>
        ))}</div>
      )}
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
