import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import { useMe } from '../../../api/hooks';
import { Avatar } from '../../../ui/Avatar';
import { Chip } from '../../../ui/Badge';
import { Empty } from '../../../ui/Empty';
import { BoardCard } from '../commons/BoardCard';
import { Messages } from './Messages';
import { Notifications } from './Notifications';
import { Tickets } from './Tickets';
import { ProfileForm } from './ProfileForm';
import { YourData } from './YourData';

const Sec = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginTop: 'var(--s5)' }}><h2 style={{ marginBottom: 'var(--s2)' }}>{title}</h2>{children}</section>);

export function Component() {
  const me = useMe().data?.user;
  const id = me?.id ?? '';
  const prof = useQuery({ queryKey: ['commons', 'profile', id], enabled: !!id, queryFn: () => unwrap(api.GET('/commons/profiles/{userId}', { params: { path: { userId: id } } })) });
  // ponytail: no author filter on the API, so scan the first 50 live posts; add ?mine when it matters.
  const board = useQuery({ queryKey: ['commons', 'board', 'mine'], enabled: !!id, queryFn: () => unwrap(api.GET('/commons/board-posts', { params: { query: { limit: 50 } } })) });
  const p = prof.data;
  if (!p) return <p className="muted">{prof.error ? prof.error.message : 'Loading…'}</p>;
  const posts = board.data?.items.filter((x) => x.author.id === id) ?? [];

  return (
    <>
      <div className="page-head"><div className="row"><Avatar user={p} size="xl" /><div>
        <h1>{p.name}</h1><p className="muted">{p.label}</p>
        <p className="small muted">Helped {p.track.helped} · {p.track.gigsDone} gigs done · {p.track.projectsShipped} projects shipped</p>
      </div></div></div>
      <ProfileForm key={p.id + p.availability + p.focusUntil} p={p} />
      <Sec title="My projects">{p.projects.length ? <div className="fl">{p.projects.map((x) => <Chip key={x.id} tone="vio">{x.title}</Chip>)}</div> : <Empty text="You are not on a project yet." />}</Sec>
      <Sec title="My board posts">{posts.length ? <div className="grid grid-2">{posts.map((x) => <BoardCard key={x.id} p={x} />)}</div> : <Empty text="You have not posted on the Board yet." />}</Sec>
      <Sec title="Messages"><Messages /></Sec>
      <Sec title="Notifications"><Notifications /></Sec>
      <Sec title="Need help?"><Tickets /></Sec>
      <Sec title="Your data"><YourData /></Sec>
    </>
  );
}
