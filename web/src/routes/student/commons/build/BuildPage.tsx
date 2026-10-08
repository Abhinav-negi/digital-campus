import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../../../../api/client';
import { Empty } from '../../../../ui/Empty';
import { Icon } from '../../../../ui/Icon';
import { Challenges } from './Challenges';
import { ChallengeSheet } from './ChallengeSheet';
import { NewChallenge } from './NewChallenge';
import { Flagship } from './Flagship';
import { NewProject } from './NewProject';
import { ProjectCard } from './Projects';
import { ProjectSheet } from './ProjectSheet';

export function BuildPage() {
  const [openId, setOpenId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [chal, setChal] = useState<string>();
  const [newChal, setNewChal] = useState(false);
  const q = useQuery({ queryKey: ['commons', 'projects'], queryFn: () => unwrap(api.GET('/commons/projects')) });
  const d = q.data;
  if (!d) return <p className="muted">{q.error ? q.error.message : 'Loading…'}</p>;

  // Generated array items are typed nullable; they never are.
  const featured = d.featured.filter((p) => p != null), all = d.all.filter((p) => p != null);
  return (
    <>
      {d.flagship && <Flagship p={d.flagship} onOpen={setOpenId} />}
      <div className="row between" style={{ margin: 'var(--s5) 0 var(--s3)' }}>
        <h3>Featured and community</h3>
        <button type="button" className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> New project</button>
      </div>
      {featured.length ? <div className="strip">{featured.map((p) => <ProjectCard key={p.id} p={p} feat onOpen={setOpenId} />)}</div>
        : <Empty seed="build" text="Nothing featured yet." />}
      <h3 style={{ margin: 'var(--s5) 0 var(--s3)' }}>All projects</h3>
      {all.length ? <div className="grid grid-2">{all.map((p) => <ProjectCard key={p.id} p={p} onOpen={setOpenId} />)}</div>
        : <Empty seed="projects" text="No other projects yet. Start one." />}
      <Challenges onOpen={setChal} onNew={() => setNewChal(true)} />
      {openId && <ProjectSheet id={openId} onClose={() => setOpenId(undefined)} />}
      {chal && <ChallengeSheet id={chal} onClose={() => setChal(undefined)} />}
      {newChal && <NewChallenge onClose={() => setNewChal(false)} onCreated={setChal} />}
      {creating && <NewProject onClose={() => setCreating(false)} onCreated={setOpenId} />}
    </>
  );
}
