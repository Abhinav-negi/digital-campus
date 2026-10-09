import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import { useMe } from '../../../api/hooks';
import { Avatar } from '../../../ui/Avatar';
import { Empty } from '../../../ui/Empty';
import { BoardCard } from '../commons/BoardCard';
import { ProjectCard } from '../commons/build/Projects';
import { ProjectSheet } from '../commons/build/ProjectSheet';
import { Messages } from './Messages';
import { Notifications } from './Notifications';
import { Tickets } from './Tickets';
import { ProfileForm } from './ProfileForm';
import { YourData } from './YourData';

const Sec = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="section"><h3>{title}</h3>{children}</div>);

export function Component() {
  const me = useMe().data?.user;
  const id = me?.id ?? '';
  const prof = useQuery({ queryKey: ['commons', 'profile', id], enabled: !!id, queryFn: () => unwrap(api.GET('/commons/profiles/{userId}', { params: { path: { userId: id } } })) });
  const board = useQuery({ queryKey: ['commons', 'board', 'mine'], enabled: !!id, queryFn: () => unwrap(api.GET('/commons/board-posts', { params: { query: { mine: 'true', limit: 50 } } })) });
  const projects = useQuery({ queryKey: ['commons', 'projects', false], enabled: !!id, queryFn: () => unwrap(api.GET('/commons/projects', { params: { query: {} } })) });
  const [openId, setOpenId] = useState<string>();
  const p = prof.data;
  if (!p) return <p className="muted">{prof.error ? prof.error.message : 'Loading…'}</p>;
  const d = projects.data;
  const mineProjects = d ? [d.flagship, ...d.featured, ...d.all].filter((x, i, a) => x?.me === 'member' && a.findIndex((y) => y?.id === x.id) === i) : [];
  const posts = board.data?.items ?? [];

  return (
    <>
      <div className="page-head"><div className="row"><Avatar user={p} size="xl" /><div>
        <h1>{p.name}</h1><p className="muted">{p.label}{p.studentIdNo && ` · ${p.studentIdNo}`}</p>
        <p className="small muted">Helped {p.track.helped} {p.track.helped === 1 ? 'person' : 'people'} · {p.track.gigsDone} gigs done · {p.track.projectsShipped} projects shipped</p>
      </div></div></div>
      <ProfileForm key={p.id + p.availability + p.focusUntil} p={p} />
      <Sec title="My projects">{mineProjects.length ? <div className="grid grid-2">{mineProjects.map((x) => x && <ProjectCard key={x.id} p={x} onOpen={setOpenId} />)}</div> : <Empty text="You are not on a project yet." />}</Sec>
      {openId && <ProjectSheet id={openId} onClose={() => setOpenId(undefined)} />}
      <Sec title="My board posts">{posts.length ? <div className="grid grid-2">{posts.map((x) => <BoardCard key={x.id} p={x} />)}</div> : <Empty text="You have not posted on the Board yet." />}</Sec>
      <Sec title="Messages"><Messages /></Sec>
      <Notifications />
      <div className="section"><Tickets /></div>
      <Sec title="Your data"><YourData /></Sec>
    </>
  );
}
