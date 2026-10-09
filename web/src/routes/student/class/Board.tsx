import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import type { components } from '../../../api/schema';
import { fmt } from '../../../lib/dates';
import { Badge, Chip } from '../../../ui/Badge';
import { Icon } from '../../../ui/Icon';
import { CrWillAdd } from '../../../ui/Empty';
import { AddBoardSheet, AddButton, useRemoveItem, type AddKind } from './edit/BoardForms';

type Item = components['schemas']['BoardItem'];
export type Cell = { key: string; subject: string; start: string; end: string; room: string | null; off?: boolean; tag?: 'Cancelled' | 'Moved' };
export type Day = { label: string; today: boolean; cells: Cell[] };

const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysTo = (d: string) => Math.round((new Date(d + 'T00:00').getTime() - new Date(iso(new Date()) + 'T00:00').getTime()) / 864e5);

/** Mon..Sat of the week containing `now`, as YYYY-MM-DD. */
export function weekDates(now = new Date()): string[] {
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return LABELS.map((_, i) => iso(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i)));
}

/** Show Saturday only when it has something; Mon-Fri always (PROTO). */
export function trimSat(days: Day[]): Day[] {
  return days[5]?.cells.length ? days : days.slice(0, 5);
}

const Sec = ({ title, children, add }: { title: string; children: ReactNode; add?: ReactNode }) => (
  <div className="section"><div className="row between"><h3>{title}</h3>{add}</div>{children}</div>
);

function useWeek(classId: string, termId: string | undefined, current: boolean) {
  return useQuery({
    queryKey: ['classes', classId, 'week', termId, current],
    queryFn: async (): Promise<Day[]> => {
      const today = iso(new Date());
      if (current) {
        const dates = weekDates();
        const { days } = await unwrap(api.GET('/classes/{id}/schedule', { params: { path: { id: classId }, query: { from: dates[0], to: dates[5] } } }));
        return dates.map((d, i) => ({
          label: LABELS[i]!, today: d === today,
          cells: (days.find((x) => x.date === d)?.items ?? []).filter((s) => s.kind !== 'event').map((s) => ({
            key: s.id, subject: s.subject?.name ?? s.title ?? 'Class', start: s.change?.start ?? s.start, end: s.change?.end ?? s.end, room: s.room,
            off: s.off, tag: s.change?.kind === 'cancelled' ? 'Cancelled' : s.change?.kind === 'moved' ? 'Moved' : undefined,
          })),
        }));
      }
      const t = await unwrap(api.GET('/classes/{id}/timetable', { params: { path: { id: classId }, query: { termId } } }));
      return LABELS.map((label, i) => ({
        label, today: false,
        cells: (t.days.find((d) => d.weekday === i + 1)?.slots ?? []).map((s) => ({ key: s.id, subject: s.subject.name, start: s.start, end: s.end, room: s.room })),
      }));
    },
  });
}

const dated = (items: Item[], del?: (id: string) => ReactNode) => (
  <div className="card"><div className="list">
    {[...items].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).map((b) => (
      <div className="row" key={b.id}>
        <div className="grow"><div>{b.title}</div>
          <div className="small muted">{b.date ? fmt(b.date) : ''}{b.subject ? ` · ${b.subject.name}` : ''}{b.body ? ` · ${b.body}` : ''}</div></div>
        {b.date && daysTo(b.date) < 0 ? <Chip>past</Chip> : b.date ? <Chip tone={daysTo(b.date) <= 2 ? 'due' : undefined}>{daysTo(b.date) === 0 ? 'today' : daysTo(b.date) === 1 ? 'tomorrow' : `in ${daysTo(b.date)} days`}</Chip> : null}
        {del?.(b.id)}
      </div>
    ))}
  </div></div>
);

const FileChip = ({ it }: { it: Item }) => {
  const chip = <Chip><Icon name="file" size={16} /> {it.fileName}</Chip>;
  return it.fileUrl ? <a href={it.fileUrl} target="_blank" rel="noreferrer">{chip}</a> : chip;
};

/** Read-only board for one class and term. `current` = the latest term (live week, with changes); older terms show the plain timetable. */
export function Board({ classId, termId, current, editing, staff }: { classId: string; termId?: string; current: boolean; editing?: boolean; staff?: boolean }) {
  const [adding, setAdding] = useState<AddKind>();
  const remove = useRemoveItem(classId);
  const del = editing ? remove : undefined;
  const add = (kind: AddKind, label: string) => (editing ? <AddButton label={label} onClick={() => setAdding(kind)} /> : undefined);
  const board = useQuery({
    queryKey: ['classes', classId, 'board', termId],
    queryFn: () => unwrap(api.GET('/classes/{id}/board', { params: { path: { id: classId }, query: { termId } } })),
  });
  const week = useWeek(classId, termId, current);
  if (board.error) return <p className="muted">{board.error.message}</p>;
  if (!board.data) return <p className="muted">Loading…</p>;
  const b = board.data;
  const notices = [...b.notices].sort((x, y) => Number(y.pinned) - Number(x.pinned));
  const days = week.data ? trimSat(week.data) : [];
  const empty = (what: string) => <CrWillAdd what={what} staff={staff} />;

  return (
    <div className="stack-lg">
      <div>
        <Sec title="Notices" add={add('notice', 'Notice')}>
          {notices.length ? <div className="stack">{notices.map((n) => (
            <div key={n.id} className={n.pinned ? 'card tint' : 'card'}>
              <div className="row between"><h4>{n.pinned && <Icon name="star" size={16} />} {n.title}</h4>{del?.(n.id)}</div>
              <p className="small muted">{n.body}</p>
            </div>))}</div> : empty('notices')}
        </Sec>
      </div>
      <Sec title="Timetable">
        {week.data && !days.some((d) => d.cells.length) ? empty('timetable') : (
          <div className="week">{days.map((d) => (
            <div key={d.label} className={d.today ? 'day today' : 'day'}>
              <div className="eyebrow">{d.label}</div>
              {d.cells.map((s) => (
                <div key={s.key} className={s.off ? 'slot off' : 'slot'}>
                  <b>{s.subject}</b>
                  <div className="muted">{s.start}–{s.end}{s.room ? ` · ${s.room}` : ''}</div>
                  {s.tag && <Badge kind={s.tag === 'Cancelled' ? 'danger' : 'warn'} plain>{s.tag}</Badge>}
                </div>))}
            </div>))}</div>
        )}
      </Sec>
      <Sec title="Exams" add={add('exam', 'Exam')}>{b.exams.length ? dated(b.exams, del) : empty('exam dates')}</Sec>
      <Sec title="Deadlines" add={add('deadline', 'Deadline')}>{b.deadlines.length ? dated(b.deadlines, del) : empty('deadlines')}</Sec>
      <Sec title="Syllabus">
        {b.syllabus.length ? <div className="grid grid-2">{b.syllabus.map((s) => (
          <div className="card" key={s.id}>
            <h4>{s.subject?.name ?? s.title}</h4>
            <p className="small muted" style={{ margin: 'var(--s1) 0 var(--s2)' }}>{s.units.length ? s.units.join(' · ') : s.body}</p>
            {s.fileName && <FileChip it={s} />}
          </div>))}</div> : empty('syllabus')}
      </Sec>
      <Sec title="Files" add={add('file', 'File')}>
        {b.files.length ? <div className="card"><div className="list">{b.files.map((f) => (
          <div className="row" key={f.id}>
            <span className="ico"><Icon name="file" /></span>
            <div className="grow">{f.title}<div className="small muted">{f.fileName}</div></div>
            {f.fileUrl && <a className="btn ghost sm" href={f.fileUrl} target="_blank" rel="noreferrer">Open</a>}
            {del?.(f.id)}
          </div>))}</div></div> : empty('files')}
      </Sec>
      {adding && <AddBoardSheet classId={classId} kind={adding} onClose={() => setAdding(undefined)} />}
    </div>
  );
}
