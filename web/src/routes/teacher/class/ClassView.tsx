import { useState } from 'react';
import { Link, NavLink, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import { useMe } from '../../../api/hooks';
import { Icon } from '../../../ui/Icon';
import { Composer } from '../Composer';
import { BoardTab } from './BoardTab';
import { PostsTab } from './PostsTab';

/** PROTO renderClass (teacher.html:316). `adminMode` (/a/classes/:id): every tab editable, Settings always shown. */
export function ClassView({ adminMode = false }: { adminMode?: boolean }) {
  const { id = '', '*': splat = '' } = useParams();
  const { data: me } = useMe();
  const [composing, setComposing] = useState(false);
  const cls = useQuery({ queryKey: ['classes', id], queryFn: () => unwrap(api.GET('/classes/{id}', { params: { path: { id } } })) });
  const base = adminMode ? '/a/classes' : '/t/classes';
  const c = cls.data;
  if (cls.error) return <p className="muted">{cls.error.message}</p>;
  if (!c || !me) return null;
  const ct = adminMode || c.myRole === 'classTeacher';
  const tabs = [['board', 'Board'], ['posts', 'Posts'], ['students', 'Students'], ['attendance', 'Attendance'], ...(ct ? [['settings', 'Settings']] : [])] as const;
  const tab = tabs.some(([k]) => k === splat) ? splat : 'board';
  const soon = (what: string, task: string) => <p className="muted">{what} — coming in {task}</p>;

  return (
    <>
      <Link className="backlink" to={base}>← Classes</Link>
      <div className="page-head"><div>
        <div className="eyebrow">{c.termLabel} · minimum {c.minAttendancePct}%</div>
        <h1>{c.name}</h1>
        <p className="muted">{adminMode ? `Class teacher: ${c.classTeacher.name}` : ct ? 'You are the class teacher' : `Subject teacher · ${c.mySubjects.join(', ')}`}</p>
      </div>
        <button type="button" className="btn primary" onClick={() => setComposing(true)}><Icon name="plus" size={16} /> New post</button></div>
      <div className="tabs" style={{ marginBottom: 'var(--s4)' }}>{tabs.map(([k, label]) => (
        <NavLink key={k} to={`${base}/${id}/${k}`} className={k === tab ? 'tab on' : 'tab'}>{label}</NavLink>))}
      </div>
      {tab === 'board' && <BoardTab classId={id} crNames={c.crs.map((r) => r.name).join(', ')} canEdit={ct} />}
      {tab === 'posts' && <PostsTab classId={id} userId={adminMode ? undefined : me.user.id} onNew={() => setComposing(true)} />}
      {tab === 'students' && soon('Students', 'TE-05b')}
      {tab === 'attendance' && soon('Attendance', 'TE-05b')}
      {tab === 'settings' && soon('Settings', 'TE-06')}
      {composing && <Composer classId={id} onClose={() => setComposing(false)} />}
    </>
  );
}

export const Component = () => <ClassView />;
