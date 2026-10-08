import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../../../api/client';
import { Empty } from '../../../../ui/Empty';
import { Icon } from '../../../../ui/Icon';
import { Sheet } from '../../../../ui/Sheet';
import { toast } from '../../../../ui/Toast';
import { AddButton } from './BoardForms';

type Subject = { id: string; name: string; code: string | null; teacher: { id: string; name: string } | null };
type Teacher = { id: string; name: string };

/** Add/edit one subject; the teacher is picked from GET /staff (ARCH D7). */
function SubjectSheet({ classId, subject, onClose }: { classId: string; subject?: Subject; onClose: () => void }) {
  const qc = useQueryClient();
  const [teacher, setTeacher] = useState<Teacher | null>(subject?.teacher ?? null);
  const [q, setQ] = useState('');
  const staff = useQuery({ queryKey: ['staff', q], queryFn: () => unwrap(api.GET('/staff', { params: { query: { q: q.trim() || undefined, limit: 8 } } })) });
  const path = { id: classId, sid: subject?.id ?? '' };
  const save = useMutation({
    mutationFn: (v: { name: string; code: string }) => subject
      ? unwrap(api.PATCH('/classes/{id}/subjects/{sid}', { params: { path }, body: { name: v.name, code: v.code || null, teacherId: teacher!.id } }))
      : unwrap(api.POST('/classes/{id}/subjects', { params: { path: { id: classId } }, body: { name: v.name, code: v.code || undefined, teacherId: teacher!.id } })),
    onSuccess: async () => {
      await Promise.all([['subjects'], ['board'], ['history']].map((k) => qc.invalidateQueries({ queryKey: ['classes', classId, ...k] })));
      toast(subject ? 'Subject updated' : 'Subject added');
      onClose();
    },
    onError: (e) => toast(e.message),
  });
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    save.mutate({ name: String(fd.get('name')).trim(), code: String(fd.get('code')).trim() });
  };
  return (
    <Sheet title={subject ? 'Edit subject' : 'Add a subject'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="field"><label htmlFor="sb-name">Subject name</label><input id="sb-name" className="input" name="name" defaultValue={subject?.name} required /></div>
        <div className="field"><label htmlFor="sb-code">Code (optional)</label><input id="sb-code" className="input" name="code" defaultValue={subject?.code ?? ''} /></div>
        <div className="field">
          <label htmlFor="sb-q">Teacher</label>
          <input id="sb-q" className="input" type="search" placeholder="Search by name or department" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="row wrap" style={{ marginTop: 'var(--s1)' }}>
            {(staff.data?.items ?? []).map((t) => (
              <button key={t.id} type="button" className={teacher?.id === t.id ? 'chip on' : 'chip'} aria-pressed={teacher?.id === t.id} onClick={() => setTeacher(t)}>
                {t.name}{t.dept ? ` · ${t.dept}` : ''}
              </button>
            ))}
          </div>
          {teacher && teacher.id !== subject?.teacher?.id && <p className="small muted">{teacher.name} will be notified.</p>}
        </div>
        <button className="btn primary block" type="submit" disabled={save.isPending || !teacher}>Save</button>
      </form>
    </Sheet>
  );
}

/** CR edit mode: the class's subjects with their teachers (SPEC §6, CS-03). */
export function Subjects({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const [sheet, setSheet] = useState<{ subject?: Subject } | null>(null);
  const list = useQuery({ queryKey: ['classes', classId, 'subjects'], queryFn: () => unwrap(api.GET('/classes/{id}/subjects', { params: { path: { id: classId } } })) });
  const del = useMutation({
    mutationFn: (sid: string) => unwrap(api.DELETE('/classes/{id}/subjects/{sid}', { params: { path: { id: classId, sid } } })),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['classes', classId] }); toast('Subject removed'); },
    onError: (e) => toast(e.message),
  });
  const items = list.data?.items ?? [];
  return (
    <section className="section">
      <div className="row between"><h3>Subjects</h3><AddButton label="Subject" onClick={() => setSheet({})} /></div>
      {list.data && !items.length && <Empty text="No subjects yet." />}
      <div className="stack">
        {items.map((s) => (
          <div key={s.id} className="card row">
            <div className="grow">
              <b>{s.name}</b>{s.code && <span className="small muted"> · {s.code}</span>}
              <div className="small muted">{s.teacher ? s.teacher.name : 'No teacher yet'}</div>
            </div>
            <button type="button" className="icon-btn" aria-label={`Edit ${s.name}`} onClick={() => setSheet({ subject: s })}><Icon name="edit" size={16} /></button>
            <button type="button" className="icon-btn" aria-label={`Remove ${s.name}`} disabled={del.isPending} onClick={() => del.mutate(s.id)}><Icon name="x" size={16} /></button>
          </div>
        ))}
      </div>
      {sheet && <SubjectSheet classId={classId} subject={sheet.subject} onClose={() => setSheet(null)} />}
    </section>
  );
}
