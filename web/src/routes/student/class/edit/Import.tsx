import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap, type ApiError } from '../../../../api/client';
import type { components } from '../../../../api/schema';
import { Badge } from '../../../../ui/Badge';
import { toast } from '../../../../ui/Toast';

type TT = components['schemas']['TimetableDraft'];
type SY = components['schemas']['SyllabusDraft'];
type DS = components['schemas']['DatesheetDraft'];
type Draft = TT | SY | DS;
type Kind = 'timetable' | 'syllabus' | 'datesheet';
type Issue = 'unmatched-teacher' | 'bad-time' | 'unknown-subject' | 'bad-date';
type Row = { issue?: Issue };

const KINDS: [Kind, string][] = [['timetable', 'Timetable'], ['syllabus', 'Syllabus'], ['datesheet', 'Exam datesheet']];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LABEL: Record<Issue, string> = { 'unmatched-teacher': 'need a teacher', 'bad-time': 'bad time', 'unknown-subject': 'unknown subject', 'bad-date': 'bad date' };

/** "12 ready · 2 need a teacher": every row without an issue is ready; each issue kind counts on its own. */
export const summaryLine = (rows: Row[]) => {
  const n: Partial<Record<Issue, number>> = {};
  for (const r of rows) if (r.issue) n[r.issue] = (n[r.issue] ?? 0) + 1;
  const bad = (Object.keys(n) as Issue[]).map((k) => `${n[k]} ${LABEL[k]}`);
  return [`${rows.filter((r) => !r.issue).length} ready`, ...bad].join(' · ');
};
const rowsOf = (d: Draft): Row[] => ('slots' in d ? [...d.subjects, ...d.slots] : 'exams' in d ? d.exams : d.subjects);

const Status = ({ issue }: Row) => issue ? <Badge kind={issue === 'unmatched-teacher' || issue === 'unknown-subject' ? 'warn' : 'danger'}>{LABEL[issue]}</Badge> : <Badge kind="open">Ready</Badge>;
const cell = (v: string | null | undefined, set: (v: string) => void, label: string, type = 'text') =>
  <input className="input" type={type} aria-label={label} value={v ?? ''} onChange={(e) => set(e.target.value)} />;
const swap = <T,>(a: T[], i: number, patch: Partial<T>) => a.map((x, j) => (j === i ? { ...x, ...patch } : x));

/** Inline staff picker for a timetable subject whose teacher name did not match. */
function TeacherPick({ onPick }: { onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const staff = useQuery({ queryKey: ['staff', q], queryFn: () => unwrap(api.GET('/staff', { params: { query: { q: q.trim() || undefined, limit: 8 } } })) });
  return (
    <div className="stack">
      <input className="input" type="search" placeholder="Search staff" aria-label="Search staff" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="row wrap">{(staff.data?.items ?? []).filter((t) => t.dept).slice(0, 5).map((t) => <button key={t.id} type="button" className="chip" onClick={() => onPick(t.id)}>{t.name}</button>)}</div>
    </div>
  );
}

function Preview({ draft, set, subjects }: { draft: Draft; set: (d: Draft) => void; subjects: { id: string; name: string }[] }) {
  const pick = (v: string | null, on: (id: string | null) => void, label: string) => (
    <select className="input" aria-label={label} value={v ?? ''} onChange={(e) => on(e.target.value || null)}>
      <option value="">No subject</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>);
  if ('slots' in draft) {
    const names = draft.subjects.map((s) => s.name);
    return (
      <>
        <table className="preview-table">
          <thead><tr><th>Subject</th><th>Code</th><th>Teacher</th><th></th></tr></thead>
          <tbody>{draft.subjects.map((s, i) => (
            <tr key={i}>
              <td>{cell(s.name, (name) => set({ ...draft, subjects: swap(draft.subjects, i, { name }) }), 'Subject name')}</td>
              <td>{cell(s.code, (code) => set({ ...draft, subjects: swap(draft.subjects, i, { code }) }), 'Code')}</td>
              <td>{s.teacherId ? <span className="small">{s.teacherName || 'Chosen'}</span> : <TeacherPick onPick={(teacherId) => set({ ...draft, subjects: swap(draft.subjects, i, { teacherId, issue: undefined }) })} />}
                {s.teacherName && !s.teacherId && <div className="small muted">Chatbot said: {s.teacherName}</div>}</td>
              <td><Status issue={s.issue} /></td>
            </tr>))}</tbody>
        </table>
        <table className="preview-table" style={{ marginTop: 'var(--s3)' }}>
          <thead><tr><th>Subject</th><th>Day</th><th>Start</th><th>End</th><th>Room</th><th></th></tr></thead>
          <tbody>{draft.slots.map((s, i) => {
            const up = (p: Partial<typeof s>) => set({ ...draft, slots: swap(draft.slots, i, { ...p, issue: undefined }) });
            return (
              <tr key={i}>
                <td><select className="input" aria-label="Subject" value={s.subject} onChange={(e) => up({ subject: e.target.value })}>
                  {!names.includes(s.subject) && <option value={s.subject}>{s.subject}</option>}{names.map((n) => <option key={n}>{n}</option>)}</select></td>
                <td><select className="input" aria-label="Day" value={s.weekday} onChange={(e) => up({ weekday: Number(e.target.value) })}>
                  {DAYS.map((d, k) => <option key={d} value={k + 1}>{d}</option>)}</select></td>
                <td>{cell(s.start, (start) => up({ start }), 'Start', 'time')}</td>
                <td>{cell(s.end, (end) => up({ end }), 'End', 'time')}</td>
                <td>{cell(s.room, (room) => up({ room }), 'Room')}</td>
                <td><Status issue={s.issue} /></td>
              </tr>);
          })}</tbody>
        </table>
      </>);
  }
  if ('exams' in draft) {
    return (
      <table className="preview-table">
        <thead><tr><th>Subject</th><th>Title</th><th>Date</th><th>Note</th><th></th></tr></thead>
        <tbody>{draft.exams.map((e, i) => {
          const up = (p: Partial<typeof e>) => set({ ...draft, exams: swap(draft.exams, i, { ...p, issue: undefined }) });
          return (
            <tr key={i}>
              <td>{pick(e.subjectId, (subjectId) => up({ subjectId }), `Subject for ${e.subject}`)}<div className="small muted">{e.subject}</div></td>
              <td>{cell(e.title, (title) => up({ title }), 'Title')}</td>
              <td>{cell(e.date, (date) => up({ date }), 'Date')}</td>
              <td>{cell(e.note, (note) => up({ note }), 'Note')}</td>
              <td><Status issue={e.issue} /></td>
            </tr>);
        })}</tbody>
      </table>);
  }
  return (
    <table className="preview-table">
      <thead><tr><th>Subject</th><th>Units</th><th></th></tr></thead>
      <tbody>{draft.subjects.map((s, i) => (
        <tr key={i}>
          <td>{pick(s.subjectId, (subjectId) => set({ ...draft, subjects: swap(draft.subjects, i, { subjectId, issue: undefined }) }), `Subject for ${s.name}`)}<div className="small muted">{s.name}</div></td>
          <td className="small">{s.units.length} unit{s.units.length === 1 ? '' : 's'}: {s.units.join(', ')}</td>
          <td><Status issue={s.issue} /></td>
        </tr>))}</tbody>
    </table>);
}

/** CR edit mode: import a timetable / syllabus / datesheet through any chatbot (ARCH D8, CS-06): prompt → paste reply → editable preview → apply. */
export function Import({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>('timetable');
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<Draft>();
  const [err, setErr] = useState<string>();
  const prompts = useQuery({ queryKey: ['classes', classId, 'imports', 'prompts'], queryFn: () => unwrap(api.GET('/classes/{id}/imports/prompts', { params: { path: { id: classId } } })) });
  const subj = useQuery({ queryKey: ['classes', classId, 'subjects'], queryFn: () => unwrap(api.GET('/classes/{id}/subjects', { params: { path: { id: classId } } })), enabled: kind !== 'timetable' });
  const reset = () => { setDraft(undefined); setText(''); setErr(undefined); };
  const preview = useMutation({
    mutationFn: () => unwrap(api.POST('/classes/{id}/imports/preview', { params: { path: { id: classId } }, body: { kind, data: text } })),
    onSuccess: (r) => { setErr(undefined); setDraft(r.draft); },
    onError: (e: ApiError) => setErr(e.message),
  });
  const apply = useMutation({
    mutationFn: () => unwrap(api.POST('/classes/{id}/imports/apply', { params: { path: { id: classId } }, body: { kind, draft } as never })),
    onSuccess: async (r) => {
      const teachers = draft && 'slots' in draft ? new Set(draft.subjects.flatMap((s) => (s.teacherId ? [s.teacherId] : []))).size : 0;
      await qc.invalidateQueries({ queryKey: ['classes', classId] });
      await qc.invalidateQueries({ queryKey: ['me'] });
      const c = r.counts;
      toast(kind === 'timetable' ? `Timetable added · ${c.slots ?? 0} classes · ${teachers} teachers notified` : kind === 'syllabus' ? `Syllabus added · ${c.items ?? 0} subjects` : `Datesheet added · ${c.items ?? 0} exams`);
      reset();
    },
    onError: (e: ApiError) => toast(e.message),
  });
  const file = async (f?: File) => { if (f) setText(await f.text()); };
  const rows = draft ? rowsOf(draft) : [];
  const blocked = draft && 'slots' in draft ? draft.slots.some((s) => s.issue) : draft && 'exams' in draft ? draft.exams.some((e) => e.issue === 'bad-date') : rows.some((r) => r.issue);
  const prompt = prompts.data?.[kind] ?? '';
  return (
    <section className="section" id="import">
      <h3>Import with a chatbot</h3>
      <div className="stack">
        <div className="row wrap">{KINDS.map(([k, label]) => <button key={k} type="button" className={k === kind ? 'chip on' : 'chip'} aria-pressed={k === kind} onClick={() => { setKind(k); reset(); }}>{label}</button>)}</div>
        {!draft && (
          <>
            <div className="field"><label htmlFor="im-prompt">Prompt</label><textarea id="im-prompt" className="input" readOnly rows={5} value={prompt} /></div>
            <button type="button" className="btn" disabled={!prompt} onClick={() => navigator.clipboard.writeText(prompt).then(() => toast('Prompt copied'), () => toast('Select the prompt and copy it'))}>Copy prompt</button>
            <p className="small muted">Paste this into ChatGPT, Gemini or Claude with your PDF or photo, then paste its reply below.</p>
            <div className="field"><label htmlFor="im-reply">The chatbot's reply</label>
              <textarea id="im-reply" className="input" rows={6} value={text} onChange={(e) => setText(e.target.value)} aria-invalid={!!err} />
              {err && <p className="small" role="alert" style={{ color: 'var(--danger)', whiteSpace: 'pre-wrap' }}>{err}</p>}</div>
            <div className="row wrap">
              <label className="btn" htmlFor="im-file">Pick a .json file</label>
              <input id="im-file" type="file" accept=".json,application/json" hidden onChange={(e) => void file(e.target.files?.[0])} />
              <button type="button" className="btn primary" disabled={!text.trim() || preview.isPending} onClick={() => preview.mutate()}>Preview</button>
            </div>
          </>)}
        {draft && (
          <>
            <p className="small"><b>{summaryLine(rows)}</b></p>
            <Preview draft={draft} set={setDraft} subjects={subj.data?.items ?? []} />
            <div className="row wrap">
              <button type="button" className="btn primary" disabled={apply.isPending || !!blocked} onClick={() => apply.mutate()}>Confirm and add</button>
              <button type="button" className="btn" onClick={() => setDraft(undefined)}>Back</button>
            </div>
          </>)}
        <p className="small"><a href="#week-editor">Enter it by hand</a></p>
      </div>
    </section>
  );
}
