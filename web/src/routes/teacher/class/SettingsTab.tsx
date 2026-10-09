import { useState, type FormEvent } from 'react';
import { Sheet } from '../../../ui/Sheet';
import { toast } from '../../../ui/Toast';
import { useClassSettings, useStaffSearch } from '../queries';

type Card = { id: string; name: string; semester: number; minAttendancePct: number; classTeacher: { id: string } };
const err = (e: unknown) => toast((e as Error).message);

/** Confirm sheet for the two irreversible actions. */
function Confirm({ title, text, label, busy, onYes, onClose }: { title: string; text: string; label: string; busy: boolean; onYes: () => void; onClose: () => void }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p>{text}</p>
      <div className="actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn primary" disabled={busy} onClick={onYes}>{label}</button>
      </div>
    </Sheet>
  );
}

/** PROTO tabSettings (teacher.html:387). Class teacher or admin only (gated in ClassView). The min % the server accepts is 1-99. */
export function SettingsTab({ c, isAdmin }: { c: Card; isAdmin: boolean }) {
  const { setMin, nextTerm, graduate, handover } = useClassSettings(c.id);
  const [confirm, setConfirm] = useState<'next' | 'grad' | null>(null);
  const [q, setQ] = useState('');
  const [to, setTo] = useState<{ id: string; name: string } | null>(null);
  const staff = useStaffSearch(q);
  const last = c.semester >= 8;

  const saveMin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMin.mutate(Number(new FormData(e.currentTarget).get('minp')), { onSuccess: () => toast('Minimum saved'), onError: err });
  };
  const run = (m: typeof nextTerm | typeof graduate, msg: string) => m.mutate(undefined, { onSuccess: () => { setConfirm(null); toast(msg); }, onError: err });

  return (
    <div className="stack-lg" style={{ maxWidth: 560 }}>
      <form className="card stack" onSubmit={saveMin}>
        <h3>Minimum attendance</h3>
        <p className="muted small">Students below this percentage get a warning on their dashboard.</p>
        <div className="field"><label htmlFor="minp">Minimum %</label>
          <input className="input" id="minp" name="minp" type="number" min={1} max={99} defaultValue={c.minAttendancePct} required /></div>
        <div><button className="btn primary" type="submit" disabled={setMin.isPending}>Save</button></div>
      </form>

      <div className="card stack">
        <h3>{last ? 'Graduate class' : 'Start next semester'}</h3>
        {last
          ? <p className="muted small">Semester 8 is the last one. Graduating archives the class; students keep their Commons profile.</p>
          : <p className="muted small">Moves the class from semester {c.semester} to {c.semester + 1}. Do this after exams.</p>}
        <div>
          {last
            ? <button type="button" className="btn primary" onClick={() => setConfirm('grad')}>Graduate class</button>
            : <button type="button" className="btn primary" onClick={() => setConfirm('next')}>Start semester {c.semester + 1}</button>}
        </div>
      </div>
      {isAdmin && !last && (
        <div className="card stack">
          <h3>Graduate class</h3>
          <p className="muted small">Admin only: archive this class before semester 8.</p>
          <div><button type="button" className="btn" onClick={() => setConfirm('grad')}>Graduate class</button></div>
        </div>)}

      <div className="card stack">
        <h3>Hand over class</h3>
        <p className="muted small">Pass this class to another teacher. They become the class teacher and you lose this tab.</p>
        <div className="field"><label htmlFor="ho-q">Teacher</label>
          <input id="ho-q" className="input" type="search" placeholder="Search by name or department" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="row wrap" style={{ marginTop: 'var(--s1)' }}>
            {(staff.data?.items ?? []).filter((t) => t.id !== c.classTeacher.id).map((t) => (
              <button key={t.id} type="button" className={to?.id === t.id ? 'chip on' : 'chip'} aria-pressed={to?.id === t.id} onClick={() => setTo(t)}>
                {t.name}{t.dept ? ` · ${t.dept}` : ''}
              </button>))}
          </div>
        </div>
        <div><button type="button" className="btn" disabled={!to || handover.isPending}
          onClick={() => window.confirm(`Hand ${c.name} over to ${to!.name}?`) && handover.mutate(to!.id, { onSuccess: () => toast(`Handed over to ${to!.name}`), onError: err })}>Hand over</button></div>
      </div>

      {confirm === 'next' && (
        <Confirm title={`Start semester ${c.semester + 1}?`} label={`Start semester ${c.semester + 1}`} busy={nextTerm.isPending} onClose={() => setConfirm(null)}
          text={`Semester ${c.semester} → ${c.semester + 1}. Subjects, timetable and attendance of Semester ${c.semester} are kept read-only. The roster carries over. Your CR will add the new timetable.`}
          onYes={() => run(nextTerm, `Semester ${c.semester + 1} started`)} />)}
      {confirm === 'grad' && (
        <Confirm title="Graduate this class?" label="Graduate class" busy={graduate.isPending} onClose={() => setConfirm(null)}
          text={`${c.name} will be archived and closed for good. Students keep their Commons profile. This cannot be undone.`}
          onYes={() => run(graduate, 'Class graduated')} />)}
    </div>
  );
}
