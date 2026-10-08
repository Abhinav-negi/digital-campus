import { useState } from 'react';
import { Empty } from '../../ui/Empty';
import { useAudit, type AuditFilters } from './queries';

const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

// AF-05: audit log, newest first (PROTO admin.html:97-98), filters + cursor paging (AD-08).
export function Component() {
  const [f, setF] = useState<AuditFilters>({});
  const q = useAudit(f);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  // ponytail: actor/class pickers list only those seen in loaded rows; add an admin people/classes picker if that proves too narrow.
  const [seen] = useState({ actors: new Map<string, string>(), classes: new Map<string, string>() });
  for (const i of items) {
    if (!seen.actors.has(i.actor.id)) seen.actors.set(i.actor.id, i.actor.name);
    if (i.class && !seen.classes.has(i.class.id)) seen.classes.set(i.class.id, i.class.name);
  }
  const set = (k: keyof AuditFilters) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value || undefined }));
  return (
    <>
      <div className="page-head"><div><h1>Audit log</h1><p className="muted">Every admin action, newest first.</p></div></div>
      <div className="row" style={{ flexWrap: 'wrap', margin: 'var(--s2) 0' }}>
        <select className="input" aria-label="Actor" value={f.actorId ?? ''} onChange={set('actorId')}>
          <option value="">Any actor</option>{[...seen.actors].map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        <select className="input" aria-label="Class" value={f.classId ?? ''} onChange={set('classId')}>
          <option value="">Any class</option>{[...seen.classes].map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        <input className="input" aria-label="Action" placeholder="Action, e.g. user." value={f.action ?? ''} onChange={set('action')} />
        <input className="input" type="date" aria-label="From" value={f.from ?? ''} onChange={set('from')} />
        <input className="input" type="date" aria-label="To" value={f.to ?? ''} onChange={set('to')} />
      </div>
      {q.error && <p className="muted">{q.error.message}</p>}
      {q.data && !items.length && <Empty text="No admin actions yet." />}
      <div className="list">
        {items.map((x) => (
          <div key={x.id}><p><strong>{x.action}</strong> · {x.detail}</p>
            <p className="muted tiny">{x.actor.name}{x.class ? ` · ${x.class.name}` : ''} · {when(x.createdAt)}</p></div>))}
      </div>
      {q.hasNextPage && <button type="button" className="btn" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>Load more</button>}
    </>
  );
}
