import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../../../api/client';
import { Badge } from '../../../../ui/Badge';
import { Icon } from '../../../../ui/Icon';
import { Sheet } from '../../../../ui/Sheet';
import { toast } from '../../../../ui/Toast';
import { AddButton } from './BoardForms';

export type Slot = { subjectId: string; subjectName: string; weekday: number; start: string; end: string; room: string };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Same maths as ARCH 9.3, on the draft: same weekday and the intervals overlap. */
export const clashes = (a: Slot, b: Slot) => a !== b && a.weekday === b.weekday && a.start < b.end && b.start < a.end;

function SlotSheet({ subjects, slot, onSave, onClose }: {
  subjects: { id: string; name: string }[]; slot?: Slot; onSave: (s: Slot) => void; onClose: () => void;
}) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const subjectId = String(fd.get('subject'));
    const start = String(fd.get('start')), end = String(fd.get('end'));
    if (start >= end) return toast('End must be after start');
    onSave({ subjectId, subjectName: subjects.find((s) => s.id === subjectId)?.name ?? '', weekday: Number(fd.get('day')), start, end, room: String(fd.get('room')).trim() });
  };
  return (
    <Sheet title={slot ? 'Edit slot' : 'Add a slot'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="field"><label htmlFor="wk-sub">Subject</label>
          <select id="wk-sub" className="input" name="subject" defaultValue={slot?.subjectId} required>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
        <div className="field"><label htmlFor="wk-day">Day</label>
          <select id="wk-day" className="input" name="day" defaultValue={slot?.weekday ?? 1}>
            {DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
          </select></div>
        <div className="row">
          <div className="field grow"><label htmlFor="wk-s">Start</label><input id="wk-s" className="input" type="time" name="start" defaultValue={slot?.start ?? '09:00'} required /></div>
          <div className="field grow"><label htmlFor="wk-e">End</label><input id="wk-e" className="input" type="time" name="end" defaultValue={slot?.end ?? '10:00'} required /></div>
        </div>
        <div className="field"><label htmlFor="wk-r">Room (optional)</label><input id="wk-r" className="input" name="room" defaultValue={slot?.room ?? ''} /></div>
        <button className="btn primary block" type="submit">Done</button>
      </form>
    </Sheet>
  );
}

/** CR edit mode: the weekly timetable. Edits a local draft; Save replaces the whole week (CS-04 PUT). Clashes are shown, never blocked (D11). */
export function WeekEditor({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Slot[] | null>(null);
  const [sheet, setSheet] = useState<{ i?: number } | null>(null);
  const week = useQuery({ queryKey: ['classes', classId, 'timetable'], queryFn: () => unwrap(api.GET('/classes/{id}/timetable', { params: { path: { id: classId } } })) });
  const subj = useQuery({ queryKey: ['classes', classId, 'subjects'], queryFn: () => unwrap(api.GET('/classes/{id}/subjects', { params: { path: { id: classId } } })) });
  useEffect(() => {
    if (week.data) setDraft(week.data.days.flatMap((d) => d.slots.map((s) => ({ subjectId: s.subject.id, subjectName: s.subject.name, weekday: s.weekday, start: s.start, end: s.end, room: s.room ?? '' }))));
  }, [week.data]);
  const save = useMutation({
    mutationFn: () => unwrap(api.PUT('/classes/{id}/timetable', { params: { path: { id: classId } }, body: { slots: (draft ?? []).map((s) => ({ subjectId: s.subjectId, weekday: s.weekday, start: s.start, end: s.end, room: s.room || undefined })) } })),
    onSuccess: async () => { await Promise.all([qc.invalidateQueries({ queryKey: ['classes', classId] }), qc.invalidateQueries({ queryKey: ['me'] })]); toast('Timetable saved'); },
    onError: (e) => toast(e.message),
  });
  const subjects = subj.data?.items ?? [];
  const slots = draft ?? [];
  const put = (s: Slot) => { setDraft((d) => sheet?.i === undefined ? [...(d ?? []), s] : (d ?? []).map((x, j) => (j === sheet.i ? s : x))); setSheet(null); };
  return (
    <section className="section" id="week-editor">
      <div className="row between"><h3>Timetable</h3><AddButton label="Slot" onClick={() => (subjects.length ? setSheet({}) : toast('Add a subject first'))} /></div>
      <div className="week">
        {DAYS.map((d, wd) => (
          <div key={d} className="day">
            <div className="eyebrow">{d}</div>
            {slots.map((s, i) => s.weekday === wd + 1 && (
              <div key={i} className="slot">
                <b>{s.subjectName}</b>
                <div className="muted">{s.start}–{s.end}{s.room && ` · ${s.room}`}</div>
                {slots.some((o) => clashes(s, o)) && <Badge kind="clash" />}
                <div className="row">
                  <button type="button" className="icon-btn" aria-label={`Edit ${s.subjectName} ${d}`} onClick={() => setSheet({ i })}><Icon name="edit" size={16} /></button>
                  <button type="button" className="icon-btn" aria-label={`Remove ${s.subjectName} ${d}`} onClick={() => setDraft(slots.filter((_, j) => j !== i))}><Icon name="x" size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <button type="button" className="btn primary block" style={{ marginTop: 'var(--s3)' }} disabled={save.isPending || !draft} onClick={() => save.mutate()}>Save timetable</button>
      {sheet && <SlotSheet subjects={subjects} slot={sheet.i === undefined ? undefined : slots[sheet.i]} onSave={put} onClose={() => setSheet(null)} />}
    </section>
  );
}
