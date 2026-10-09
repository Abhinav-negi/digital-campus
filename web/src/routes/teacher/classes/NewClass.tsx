import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import { Badge } from '../../../ui/Badge';
import { toast } from '../../../ui/Toast';
import { useBranches, useCreateClass, useInvitePreview } from '../queries';

// PROTO teacher.html:396-425, :517-538. ARCH §9.1.
const ORD = ['', '1st', '2nd', '3rd', '4th'];
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const SAMPLE = ['25ME001, ananya.s@students.demo.edu', '25ME002, rahul.k@students.demo.edu', '25ME003, sara.m@students.demo.edu', '25ME004, dev.p@students.demo.edu', '25ME005, ira.n@students.demo.edu', '25ME006, kabir.t@students.demo.edu', '25ME002, rahul.dup@students.demo.edu', '25ME007, not-an-email'].join('\n');

/** Same rule as the server's semesterFor (academic year starts in July), so the label matches the created class. */
export const semesterFor = (admissionYear: number, now = new Date()) =>
  Math.min(8, Math.max(1, (now.getFullYear() - admissionYear) * 2 + (now.getMonth() >= 6 ? 1 : 0)));
/** The admission year that makes the batch 1st year right now. */
export const defaultAdmissionYear = (now = new Date()) => now.getFullYear() - (now.getMonth() >= 6 ? 0 : 1);
export const yearLabel = (admissionYear: number, now = new Date()) => {
  const sem = semesterFor(admissionYear, now), y = Math.ceil(sem / 2);
  return `${ORD[y]} year · Semester ${sem}`;
};

type Row = { studentIdNo: string; email: string; issue: 'Duplicate' | 'Bad email' | null };
const parse = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split(/[,;\t\s]+/).filter(Boolean))
  .filter((p) => !/^(student)?id$/i.test(p[0]!)).map(([id = '', email = '']) => ({ studentIdNo: id, email: email.toLowerCase() }));
/** Offline preview (bad email, repeats inside the paste); the server dry-run adds clashes with existing accounts. */
export function localPreview(text: string): Row[] {
  const seen = new Set<string>();
  return parse(text).map((r) => {
    const k = [r.studentIdNo.toLowerCase(), r.email];
    const issue = !EMAIL.test(r.email) ? 'Bad email' : k.some((x) => seen.has(x)) ? 'Duplicate' : null;
    if (!issue) k.forEach((x) => seen.add(x));
    return { ...r, issue };
  });
}

/** `base` = where Back/finish go; `teacher` (admin only) = the class teacher to hand the new class to, `slot` renders the picker in step 1. Defaults keep the teacher flow. */
export function NewClass({ base = '/t/classes', teacher }: { base?: string; teacher?: { id: string; slot: ReactNode } }) {
  const go = useNavigate();
  const qc = useQueryClient();
  const branches = useBranches();
  const [step, setStep] = useState(1);
  const [branchId, setBranchId] = useState('');
  const [year, setYear] = useState(defaultAdmissionYear());
  const [section, setSection] = useState('');
  const [min, setMin] = useState(75);
  const [text, setText] = useState('');
  const [cr, setCr] = useState('');
  const [server, setServer] = useState<{ text: string; rows: Row[] }>();

  const branch = branches.data?.find((b) => b.id === (branchId || branches.data?.[0]?.id));
  const name = branch ? `${branch.code} · ${ORD[Math.ceil(semesterFor(year) / 2)]} year${section.trim() ? ' · ' + section.trim() : ''}` : '';

  // The dry-run endpoint hangs off a class, so a teacher who already owns one gets the full server preview.
  const mine = useQuery({ queryKey: ['classes'], queryFn: () => unwrap(api.GET('/classes')) });
  const anchor = mine.data?.items.find((c) => c.myRole === 'classTeacher' && !c.archivedAt)?.id;
  const dry = useInvitePreview();
  useEffect(() => {
    if (step !== 2 || !anchor || !parse(text).length) return;
    const t = setTimeout(() => dry.mutate({ id: anchor, rows: parse(text) }, { onSuccess: (d) => setServer({ text, rows: d.rows }) }), 400);
    return () => clearTimeout(t);
  }, [step, anchor, text]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = server?.text === text ? server.rows : localPreview(text);
  const ok = rows.filter((r) => !r.issue);
  const dup = rows.filter((r) => r.issue === 'Duplicate').length, bad = rows.filter((r) => r.issue === 'Bad email').length;

  const create = useCreateClass();
  const submit = useMutation({
    mutationFn: async () => {
      const cls = await create.mutateAsync({ branchId: branch!.id, admissionYear: year, section: section.trim(), minAttendancePct: min });
      if (teacher) {
        try { await unwrap(api.POST('/classes/{id}/handover', { params: { path: { id: cls.id } }, body: { teacherId: teacher.id } })); }
        catch (e) { toast((e as { message: string }).message); }
      }
      try {
        await unwrap(api.POST('/classes/{id}/invites', { params: { path: { id: cls.id } }, body: { rows: ok.map((r) => ({ studentIdNo: r.studentIdNo, email: r.email })), dryRun: false } }));
        const roster = await unwrap(api.GET('/classes/{id}/members', { params: { path: { id: cls.id } } }));
        const pick = roster.items.find((m) => m.studentIdNo === cr);
        if (!pick) throw { message: 'The CR you picked could not be invited. Set the CR from the class page.' };
        // ponytail: PUT /cr only accepts ACTIVE students and fresh invitees are "invited", so this 422s until the API allows it (see TE-07 notes).
        await unwrap(api.PUT('/classes/{id}/cr', { params: { path: { id: cls.id } }, body: { userIds: [pick.id] } }));
      } catch (e) {
        toast((e as { message: string }).message); // the class exists by now: carry on to it
      }
      return cls;
    },
    onSuccess: (cls) => { qc.invalidateQueries({ queryKey: ['classes'] }); toast(`Class created · ${ok.length} invites sent`); go(`${base}/${cls.id}/students`); },
    onError: (e) => toast(e.message),
  });

  const next = () => {
    if (step === 1 && !(min >= 1 && min <= 100)) return toast('Minimum must be 1 to 100');
    if (step === 2 && !ok.length) return toast('Add at least one valid student');
    setStep(step + 1);
  };
  const steps = ['Name', 'Students', 'Pick the CR'];

  return (
    <>
      <Link className="backlink" to={base}>← Classes</Link>
      <div className="page-head"><div><div className="eyebrow">Step {step} of 3 · {steps[step - 1]}</div><h1>New class</h1></div></div>
      <div style={{ maxWidth: 640 }}>
        <div className="steps">{[1, 2, 3].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
        {step === 1 && (
          <div className="card stack">
            {teacher?.slot}
            <div className="field"><label htmlFor="ncb">Branch</label>
              <select className="input" id="ncb" value={branch?.id ?? ''} onChange={(e) => setBranchId(e.target.value)}>
                {branches.data?.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}</select></div>
            <div className="field"><label htmlFor="ncy">Admission year</label>
              <input className="input" id="ncy" type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} />
              <p className="muted small">{year >= 2000 && year <= 2100 ? yearLabel(year) : 'Enter a year from 2000 to 2100'}</p></div>
            <div className="field"><label htmlFor="ncs">Section <span className="muted small">(optional)</span></label>
              <input className="input" id="ncs" maxLength={8} placeholder="e.g. A" value={section} onChange={(e) => setSection(e.target.value)} /></div>
            <p className="muted small">Class name: <strong>{name}</strong></p>
            <div className="field"><label htmlFor="ncm">Minimum attendance %</label>
              <input className="input" id="ncm" type="number" min={1} max={100} value={min} onChange={(e) => setMin(Number(e.target.value))} /></div>
          </div>)}
        {step === 2 && (
          <div className="card stack">
            <div className="field"><label htmlFor="ta-nc">Paste student ID and email</label>
              <textarea className="input" id="ta-nc" placeholder="25ME001, name@students.demo.edu" value={text} onChange={(e) => setText(e.target.value)} /></div>
            {import.meta.env.DEV && <div><button type="button" className="btn sm ghost" onClick={() => setText(SAMPLE)}>Paste a sample list</button></div>}
            {!rows.length ? <p className="muted small">Paste one student per line: ID, email. A spreadsheet copy works too.</p> : (
              <>
                <p className="small"><b>{ok.length}</b> ready{dup > 0 && <> · <span style={{ color: 'var(--warn)' }}>{dup} duplicate</span></>}{bad > 0 && <> · <span style={{ color: 'var(--danger)' }}>{bad} bad email</span></>}</p>
                <table className="tbl"><thead><tr><th>ID</th><th>Email</th><th></th></tr></thead><tbody>{rows.map((r, i) => (
                  <tr key={i}><td>{r.studentIdNo}</td><td>{r.email || <span className="muted">missing</span>}</td>
                    <td>{r.issue ? <Badge kind={r.issue === 'Duplicate' ? 'warn' : 'danger'}>{r.issue}</Badge> : <Badge kind="open">Ready</Badge>}</td></tr>))}</tbody></table>
              </>)}
          </div>)}
        {step === 3 && (
          <div className="card">
            <p className="muted small" style={{ marginBottom: 'var(--s2)' }}>Tap a student to make them CR. You can change this any time.</p>
            <div className="stack" style={{ gap: 'var(--s1)' }}>{ok.map((r) => (
              <button key={r.studentIdNo} type="button" className={`pick ${cr === r.studentIdNo ? 'on' : ''}`} onClick={() => setCr(r.studentIdNo)}>
                <b>{r.studentIdNo}</b> <span className="tiny muted">{r.email}</span>
                {cr === r.studentIdNo && <span style={{ float: 'right' }}><Badge kind="questions">CR</Badge></span>}
              </button>))}</div>
          </div>)}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 'var(--s3)' }}>
          {step > 1 && <button type="button" className="btn" onClick={() => setStep(step - 1)} disabled={submit.isPending}>Back</button>}
          {step < 3
            ? <button type="button" className="btn primary" onClick={next} disabled={!branch || (!!teacher && !teacher.id)}>Next</button>
            : <button type="button" className="btn primary" disabled={submit.isPending} onClick={() => (cr ? submit.mutate() : toast('Pick a CR first'))}>Create &amp; send invites</button>}
        </div>
      </div>
    </>
  );
}

export const Component = () => <NewClass />;
