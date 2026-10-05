import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMe } from '../../api/hooks';
import { Badge } from '../../ui/Badge';
import { Empty } from '../../ui/Empty';
import { toast } from '../../ui/Toast';
import { PastSession } from './PastSession';
import { SessionActions } from './SessionActions';
import { openAttendance, useStaffToday, type TodaySession } from './queries';

const KIND = { exam: ['questions', 'Exam'], deadline: ['danger', 'Deadline'], assignment: ['open', 'Assignment'], reminder: ['focus', 'Private reminder'] } as const;
const first = (n?: string) => n?.split(' ')[0] ?? '';

// PROTO teacher.html:178-202. ponytail: the API has no "class teacher" flag on a change author, so the badge says "by CR <name>" only when the author is not the session's teacher.
export function Component() {
  const { data: me } = useMe();
  const { data: t, error } = useStaffToday();
  const go = useNavigate();
  const [past, setPast] = useState(false);
  if (!me || !t) return error ? <p className="muted">{error.message}</p> : null;

  const h = new Date().getHours();
  const items = t.sessions.filter((s) => !s.off);
  const done = items.filter((s) => s.attendanceDone).length;
  const soon = t.upcoming.slice(0, 3);

  async function take(s: TodaySession) {
    if (!s.subject) return;
    try {
      const a = await openAttendance({ subjectId: s.subject.id, date: s.change?.date ?? t!.date, slotId: s.slotId ?? undefined });
      go(`/t/attend/${a.id}`);
    } catch (e) { toast(e instanceof Error ? e.message : 'Something went wrong. Try again.'); }
  }

  return (
    <>
      <div className="page-head"><div>
        <div className="eyebrow">{new Date(t.date + 'T00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1>{h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}, {me.user.name}</h1>
        <p className="muted">{items.length ? `${items.length} ${items.length === 1 ? 'session' : 'sessions'} today${done ? ` · ${done} done` : ''}.` : 'No sessions today.'}</p></div>
        <button type="button" className="btn" onClick={() => setPast(true)}>Fill a past session</button></div>
      <div className="stack">{items.length ? items.map((s) => {
        const cancelled = s.change?.kind === 'cancelled';
        const mine = s.canEdit && s.teacher?.id === me.user.id;
        const by = s.change && s.change.author.id !== s.teacher?.id ? `by CR ${first(s.change.author.name)}` : '';
        const start = s.change?.start ?? s.start, end = s.change?.end ?? s.end;
        return (
          <div key={s.id} className={s.attendanceDone ? 'card slot done' : 'card slot'}>
            <div className="time"><b>{start}</b><span className="tiny muted">to {end}</span></div>
            <div className="grow"><h3>{s.subject?.name ?? s.title}</h3>
              <div className="muted small">{s.class.name} · {s.room}</div>
              {s.change && (
                <div className="row wrap" style={{ marginTop: 'var(--s1)', gap: 'var(--s1)' }}>
                  <Badge kind="danger">{cancelled ? 'Cancelled' : `Moved to ${start}–${end}`}{by && ` ${by}`}</Badge>
                  <span className="tiny muted">{s.change.note}</span></div>
              )}</div>
            <div className="act row" style={{ gap: 'var(--s1)' }}>
              {s.attendanceDone
                ? <><Badge kind="open" plain>Done ✓</Badge><button type="button" className="btn sm ghost" onClick={() => take(s)}>Edit</button></>
                : <button type="button" className={cancelled ? 'btn' : 'btn primary'} onClick={() => take(s)}>{cancelled ? 'Take anyway' : 'Take attendance'}</button>}
              {mine && !cancelled && <SessionActions s={s} date={t.date} />}
            </div>
          </div>
        );
      }) : <Empty seed="Sunny" text="Nothing on your timetable today. Enjoy the quiet." />}</div>
      {soon.length > 0 && (
        <div className="section"><div className="row between"><h3>Coming up</h3><Link to="/t/upcoming" className="small">See all</Link></div>
          <div className="card"><div className="list">{soon.map((i) => {
            const d = new Date(i.date + 'T00:00'), [b, l] = KIND[i.kind];
            return (
              <div key={i.ref} className="item"><div className="dateblk"><b>{d.getDate()}</b><span className="tiny muted">{d.toLocaleDateString('en-GB', { month: 'short' })}</span></div>
                <div className="grow"><h4>{i.title}</h4><div className="tiny muted">{d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div></div>
                <Badge kind={b}>{l}</Badge></div>
            );
          })}</div></div></div>
      )}
      {past && <PastSession today={t.date} userId={me.user.id} onClose={() => setPast(false)} />}
    </>
  );
}
