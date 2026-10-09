import { Badge } from '../../../ui/Badge';
import { Icon } from '../../../ui/Icon';
import { toast } from '../../../ui/Toast';
import { useFeatured, useFeaturedMutations } from '../queries';

// AF-04b: PROTO admin.html featured(): star up to 3 projects/challenges; one project can be the flagship (shown on its own, not starrable).
export function Featured() {
  const { data, error } = useFeatured();
  const { star, flagship } = useFeaturedMutations();
  if (error) return <p className="muted">{error.message}</p>;
  if (!data) return null;
  const run = (p: Promise<unknown>) => p.catch((e: Error) => toast(e.message));
  const starBtn = (type: 'project' | 'challenge', x: { id: string; title: string; featured: boolean }) => (
    <button type="button" className={x.featured ? 'icon-btn star on' : 'icon-btn star'} aria-pressed={x.featured} aria-label={`Feature ${x.title}`} disabled={star.isPending}
      onClick={() => run(star.mutateAsync({ type, id: x.id, featured: !x.featured }))}><Icon name="star" /></button>);
  return (
    <>
      <p className="muted">Star up to 3 projects or challenges to pin them in the Commons. {data.used} of {data.max} used.</p>
      <h3>Projects</h3>
      <div className="list">{data.projects.map((p) => (
        <div key={p.id} className="row-item">
          <div className="grow"><h4>{p.title}</h4><p className="muted small">by {p.ownerName}{p.community ? ' · community' : ''}</p></div>
          {p.flagship ? <Badge kind="focus">Flagship</Badge> : <>
            <button type="button" className="btn sm" disabled={flagship.isPending} onClick={() => run(flagship.mutateAsync(p.id).then(() => toast('Flagship set.')))}>Set as flagship</button>
            {starBtn('project', p)}</>}
        </div>))}
      </div>
      <h3 className="sub">Challenges</h3>
      <div className="list">{data.challenges.map((c) => (
        <div key={c.id} className="row-item"><div className="grow"><h4>{c.title}</h4><p className="muted small">by {c.ownerName}</p></div>{starBtn('challenge', c)}</div>))}
      </div>
    </>
  );
}
