import { useState } from 'react';
import { NavLink, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import { useMe } from '../../../api/hooks';
import { Avatar } from '../../../ui/Avatar';
import { Empty } from '../../../ui/Empty';
import { Board } from './Board';

const TABS = [['', 'Board'], ['posts', 'Posts'], ['attendance', 'My attendance']] as const;

export function Component() {
  const tab = useParams()['*'] ?? '';
  const { data: me } = useMe();
  const mine = me?.classes.find((c) => c.role !== 'teacher'); // a student has one home class
  const id = mine?.id ?? '';
  const [picked, setPicked] = useState<string>();
  const cls = useQuery({ queryKey: ['classes', id], queryFn: () => unwrap(api.GET('/classes/{id}', { params: { path: { id } } })), enabled: !!id });
  const terms = useQuery({ queryKey: ['classes', id, 'terms'], queryFn: () => unwrap(api.GET('/classes/{id}/terms', { params: { path: { id } } })), enabled: !!id });

  if (!me) return null;
  if (!mine) return <Empty text="You are not in a class yet." />;
  const c = cls.data;
  const list = terms.data?.items ?? [];
  const latest = list[0]?.id;
  const termId = picked ?? latest;

  return (
    <>
      <div className="page-head"><div>
        <div className="eyebrow">{c?.termLabel}</div>
        <h1>{mine.name}</h1>
        <div className="row wrap" style={{ marginTop: 'var(--s2)' }}>
          {mine.role === 'cr' && <span className="chip vio">You are the CR</span>}
          {c && <span className="row small muted" style={{ gap: 'var(--s1)' }}><Avatar user={c.classTeacher} size="sm" /> Class teacher: {c.classTeacher.name}</span>}
        </div>
      </div></div>
      <div className="row between wrap">
        <div className="tabs">{TABS.map(([k, label]) => (
          <NavLink key={k} to={k} end className={({ isActive }) => (isActive ? 'tab on' : 'tab')}>{label}</NavLink>))}
        </div>
        {tab === '' && list.length > 1 && (
          <select className="input" style={{ width: 'auto' }} aria-label="Term" value={termId} onChange={(e) => setPicked(e.target.value)}>
            {list.map((t) => <option key={t.id} value={t.id}>{`Year ${t.yearOfStudy} · Sem ${t.semester}`}{t.endedAt ? ' (past)' : ''}</option>)}
          </select>
        )}
      </div>
      <div style={{ marginTop: 'var(--s4)' }}>
        {tab === '' && (terms.data ? <Board classId={id} termId={termId} current={termId === latest} /> : null)}
        {tab === 'posts' && <Empty text="Posts are coming soon." />}
        {tab === 'attendance' && <Empty text="Your attendance is coming soon." />}
      </div>
    </>
  );
}
