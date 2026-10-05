import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMe } from '../../api/hooks';
import { Avatar } from '../../ui/Avatar';
import { Badge, Chip } from '../../ui/Badge';
import { Bar } from '../../ui/Bar';
import { CrWillAdd, Empty } from '../../ui/Empty';
import { Icon } from '../../ui/Icon';
import { useCommonsCard, useToday, type StudentToday } from './queries';

type Slot = StudentToday['items'][number];
const KI = { exam: 'flag', deadline: 'clock', assignment: 'file', reminder: 'clock' } as const;
const COL = { safe: 'var(--success)', warn: 'var(--warn)', danger: 'var(--danger)' } as const;
const st = (s: Slot) => s.change?.start ?? s.start;
const en = (s: Slot) => s.change?.end ?? s.end;
const name = (s: Slot) => s.subject?.name ?? s.title ?? 'Class';
const fmt = (d: string) => new Date(d + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const rel = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 6e4));
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};
const Sec = ({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) => (
  <div className="section"><div className="row between"><h3>{title}</h3>{action}</div>{children}</div>
);

function Commons() {
  const { data } = useCommonsCard();
  const [rot, setRot] = useState(0);
  const items = data?.items ?? [];
  if (!items.length) return <Empty text="Nothing new in the Commons." />;
  const c = items[rot % items.length]!;
  return (
    <>
      <Link to="/s/commons" className="card tint click" style={{ display: 'block' }}>
        <div className="eyebrow">{{ answer: 'New answer on your Ask', 'join-requests': 'Join requests', ask: 'Matching your skills · unanswered', project: 'Matches your skills' }[c.type]}</div>
        {c.byline && <div className="row" style={{ margin: 'var(--s1) 0' }}><Avatar user={c.byline} size="sm" /><span className="small">{c.byline.name}</span></div>}
        <h4>{c.title}</h4><p className="small muted clamp">{c.body}</p>
      </Link>
      {items.length > 1 && (
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 'var(--s1)' }}>
          <button type="button" className="btn ghost sm" onClick={() => setRot(rot + 1)}>Next · {rot % items.length + 1} of {items.length}</button>
        </div>
      )}
    </>
  );
}

export function Component() {
  const { data: me } = useMe();
  const { data: t } = useToday();
  const nav = useNavigate();
  if (!me || !t) return null;
  const h = new Date().getHours();
  const isCr = me.classes.some((c) => c.role === 'cr');
  const pick = t.current ?? t.next;
  return (
    <>
      <div className="page-head"><div>
        <h1>{h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}, {me.user.name.split(' ')[0]}</h1>
        <p className="muted">{new Date(t.date + 'T00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div></div>
      <div className="stack">
        {t.cancelled.map((s) => (
          <div key={s.id} className="banner"><b>{name(s)} is cancelled today</b> <span className="small">({s.start}–{s.end})</span>
            <div className="small">{s.change?.note} <span className="muted">· posted by {s.change?.author.name}{s.change?.author.id !== s.teacher?.id && ' (CR)'}</span></div>
          </div>
        ))}
        {t.empty.timetable ? <CrWillAdd what="timetable" isCr={isCr} onAdd={() => nav('/s/class')} /> : (
          <>
            <div className="card hero">
              {pick ? (
                <>
                  <div className="eyebrow">{t.current ? 'Happening now' : 'Up next'}</div>
                  <h1>{name(pick)}</h1>
                  <p className="muted">{st(pick)}–{en(pick)} · {pick.room} · {pick.teacher?.name}{pick.change && ' · moved'}</p>
                </>
              ) : (
                <><div className="eyebrow">Today</div><h1>No more classes today</h1><p className="muted">Enjoy the rest of your day.</p></>
              )}
            </div>
            <div className="card"><div className="eyebrow" style={{ marginBottom: 'var(--s2)' }}>Today's schedule</div><div className="list">
              {t.items.map((s) => {
                const gone = s.change?.kind === 'cancelled';
                return (
                  <div key={s.id} className="row">
                    <span className="small muted" style={{ width: 'var(--s8)' }}>{st(s)}</span>
                    <div className={gone ? 'grow muted' : 'grow'} style={gone ? { textDecoration: 'line-through' } : undefined}>{name(s)}<div className="tiny muted">{s.room}</div></div>
                    {s.clashWith.length > 0 && <Badge kind="clash" />}
                    {s.change && (gone || s.change.kind === 'moved') && <Badge kind={gone ? 'danger' : 'warn'} plain>{gone ? 'Cancelled' : 'Moved'}</Badge>}
                  </div>
                );
              })}
            </div></div>
          </>
        )}
      </div>
      <Sec title="Attendance" action={<Link className="btn ghost sm" to="/s/class/attendance">Details</Link>}>
        <div className="card"><div className="stack">
          {t.attendance.length === 0 && <Empty text="No attendance yet." />}
          {t.attendance.map((a) => (
            <div key={a.subject.id} className="stack" style={{ gap: 'var(--s1)' }}>
              <div className="row between"><span>{a.subject.name}</span><span className="small" style={{ color: COL[a.status] }}>{a.pct}% · {a.text}</span></div>
              <Bar pct={a.pct} status={a.status} />
            </div>
          ))}
        </div></div>
      </Sec>
      <Sec title="Coming up">
        <div className="card">{t.upcoming.length ? <div className="list">{t.upcoming.map((u) => (
          <div key={u.ref} className="row"><span className="ico"><Icon name={KI[u.kind]} /></span>
            <div className="grow"><div>{u.title}</div><div className="small muted">{u.kind} · {fmt(u.date)}</div></div></div>
        ))}</div> : <Empty text="Nothing due in the next two weeks." />}</div>
      </Sec>
      <Sec title="New from teachers">
        {t.unreadPosts.length ? <div className="stack">{t.unreadPosts.map((p) => (
          <Link key={p.id} to="/s/class/posts" className="card click" style={{ display: 'block' }}>
            <div className="row"><Avatar user={p.author} size="sm" /><div className="grow"><b>{p.author.name}</b> <span className="small muted">· {rel(p.createdAt)}</span></div><Chip tone="vio">New</Chip></div>
            <h4 style={{ marginTop: 'var(--s2)' }}>{p.title}</h4>
          </Link>
        ))}</div> : <Empty text="You're all caught up." />}
      </Sec>
      <Sec title="From the Commons"><Commons /></Sec>
    </>
  );
}
