import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../../../api/client';
import type { components, paths } from '../../../../api/schema';
import { Badge } from '../../../../ui/Badge';
import { Sheet } from '../../../../ui/Sheet';
import { toast } from '../../../../ui/Toast';
import { AddButton } from './BoardForms';

type Item = components['schemas']['ScheduleItem'];
type Body = NonNullable<paths['/classes/{id}/changes']['post']['requestBody']>['content']['application/json'];
const DAYS = 14;

/** `n` consecutive ISO dates from `from` (UTC maths, so no DST drift). */
export const dateRun = (from: string, n = DAYS) => Array.from({ length: n }, (_, i) => new Date(Date.parse(from) + i * 864e5).toISOString().slice(0, 10));
export const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const name = (i: Item) => i.subject?.name ?? i.title ?? 'Event';
const localToday = () => new Date().toLocaleDateString('en-CA');

function ItemSheet({ item, date, onDo, onClose }: { item: Item; date: string; onDo: (b: Body | 'undo') => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const slot = item.kind === 'class' && item.slotId;
  const orig = item.change?.date ?? date; // a moved class is changed on its original date
  const run = async (b: Body | 'undo') => { setBusy(true); try { await onDo(b); onClose(); } catch (e) { toast(e instanceof Error ? e.message : 'Something went wrong. Try again.'); } finally { setBusy(false); } };
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const start = String(fd.get('start')), end = String(fd.get('end'));
    const note = String(fd.get('note')).trim() || undefined;
    if (fd.get('act') === 'cancelled') return void run({ date: orig, kind: 'cancelled', slotId: item.slotId!, note });
    if (start >= end) return toast('End must be after start');
    void run({ date: orig, kind: 'moved', slotId: item.slotId!, start, end, room: String(fd.get('room')).trim() || undefined, movedToDate: String(fd.get('to')) || undefined, note });
  };
  return (
    <Sheet title={`${name(item)}, ${item.start}`} onClose={onClose}>
      <div className="stack">
        {item.clashWith.length > 0 && <p className="small"><Badge kind="clash" /> Both teachers have been asked who's taking it.</p>}
        {item.change?.note && <p className="small muted">{item.change.note}</p>}
        {slot && (
          <form className="stack" onSubmit={submit}>
            <div className="field"><label htmlFor="wa-act">What happened?</label>
              <select id="wa-act" className="input" name="act" defaultValue="moved"><option value="cancelled">Cancel</option><option value="moved">Move</option></select></div>
            <div className="field"><label htmlFor="wa-to">Move to date</label><input id="wa-to" className="input" type="date" name="to" defaultValue={item.change?.movedToDate ?? date} /></div>
            <div className="row">
              <div className="field grow"><label htmlFor="wa-s">Start</label><input id="wa-s" className="input" type="time" name="start" defaultValue={item.start} required /></div>
              <div className="field grow"><label htmlFor="wa-e">End</label><input id="wa-e" className="input" type="time" name="end" defaultValue={item.end} required /></div>
            </div>
            <div className="field"><label htmlFor="wa-r">Room</label><input id="wa-r" className="input" name="room" defaultValue={item.room ?? ''} /></div>
            <div className="field"><label htmlFor="wa-n">Note for the class</label><textarea id="wa-n" className="input" name="note" /></div>
            <button className="btn primary block" type="submit" disabled={busy}>Save change</button>
          </form>
        )}
        {item.change && <button type="button" className="btn block" disabled={busy} onClick={() => void run('undo')}>{slot ? 'Undo the existing change' : 'Remove'}</button>}
      </div>
    </Sheet>
  );
}

function AddSheet({ date, subjects, onSave, onClose }: { date: string; subjects: { id: string; name: string }[]; onSave: (b: Body) => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const g = (k: string) => String(fd.get(k) ?? '').trim();
    const kind = g('kind') as 'extra' | 'event';
    if (g('start') >= g('end')) return toast('End must be after start');
    if (kind === 'event' && !g('title')) return toast('Give the event a title');
    setBusy(true);
    try {
      await onSave({ date, kind, subjectId: kind === 'extra' ? g('subject') : undefined, title: g('title') || undefined, start: g('start'), end: g('end'), room: g('room') || undefined, note: g('note') || undefined });
      onClose();
    } catch (err) { toast(err instanceof Error ? err.message : 'Something went wrong. Try again.'); } finally { setBusy(false); }
  };
  return (
    <Sheet title={`Add on ${dayLabel(date)}`} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="field"><label htmlFor="wa-k">What</label><select id="wa-k" className="input" name="kind"><option value="extra">Extra class</option><option value="event">Event</option></select></div>
        <div className="field"><label htmlFor="wa-sub">Subject (extra class)</label>
          <select id="wa-sub" className="input" name="subject">{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="field"><label htmlFor="wa-t">Title (event)</label><input id="wa-t" className="input" name="title" /></div>
        <div className="row">
          <div className="field grow"><label htmlFor="wa-as">Start</label><input id="wa-as" className="input" type="time" name="start" defaultValue="13:00" required /></div>
          <div className="field grow"><label htmlFor="wa-ae">End</label><input id="wa-ae" className="input" type="time" name="end" defaultValue="14:00" required /></div>
        </div>
        <div className="field"><label htmlFor="wa-ar">Room / place</label><input id="wa-ar" className="input" name="room" /></div>
        <div className="field"><label htmlFor="wa-an">Note</label><textarea id="wa-an" className="input" name="note" /></div>
        <button className="btn primary block" type="submit" disabled={busy}>Add</button>
      </form>
    </Sheet>
  );
}

/** CR edit mode: the next 14 days of the computed schedule (CS-05). Cancel / move / undo / add extras and events; clashes are shown, never blocked (D11). */
export function WeekAhead({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const [from] = useState(localToday);
  const [item, setItem] = useState<{ item: Item; date: string }>();
  const [adding, setAdding] = useState<string>();
  const to = dateRun(from).at(-1)!;
  const key = ['classes', classId, 'schedule', from];
  const sched = useQuery({ queryKey: key, queryFn: () => unwrap(api.GET('/classes/{id}/schedule', { params: { path: { id: classId }, query: { from, to } } })) });
  const subj = useQuery({ queryKey: ['classes', classId, 'subjects'], queryFn: () => unwrap(api.GET('/classes/{id}/subjects', { params: { path: { id: classId } } })) });
  const change = useMutation({
    mutationFn: (b: Body | { undo: string }) => 'undo' in b
      ? unwrap(api.DELETE('/classes/{id}/changes/{changeId}', { params: { path: { id: classId, changeId: b.undo } } }))
      : unwrap(api.POST('/classes/{id}/changes', { params: { path: { id: classId } }, body: b })),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['classes', classId, 'schedule'] }); toast('Saved'); },
  });
  const days = sched.data?.days ?? [];
  const subjects = subj.data?.items ?? [];
  return (
    <section className="section" id="week-ahead">
      <h3>This week &amp; next</h3>
      <div className="week">
        {days.map((d) => (
          <div key={d.date} className="day">
            <div className="eyebrow">{dayLabel(d.date)}</div>
            {d.items.map((i) => (
              <button type="button" key={`${i.id}-${i.start}`} className={`slot${i.off ? ' off' : ''}`} style={{ textAlign: 'left' }} onClick={() => setItem({ item: i, date: d.date })}>
                <b>{name(i)}</b>
                <div className="muted">{i.start}–{i.end}{i.room && ` · ${i.room}`}{i.change?.kind === 'cancelled' && ' · cancelled'}{i.change?.kind === 'moved' && (i.off ? ` · moved to ${dayLabel(i.change.movedToDate ?? d.date)}` : ' · moved here')}</div>
                {i.clashWith.length > 0 && <><Badge kind="clash" /><div className="small">Both teachers have been asked who's taking it.</div></>}
              </button>
            ))}
            <AddButton label="Add" onClick={() => setAdding(d.date)} />
          </div>
        ))}
      </div>
      {item && <ItemSheet item={item.item} date={item.date} onClose={() => setItem(undefined)}
        onDo={async (b) => { await change.mutateAsync(b === 'undo' ? { undo: item.item.change!.id } : b); }} />}
      {adding && <AddSheet date={adding} subjects={subjects} onClose={() => setAdding(undefined)} onSave={async (b) => { await change.mutateAsync(b); }} />}
    </section>
  );
}
