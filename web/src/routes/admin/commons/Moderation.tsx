import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import { Badge } from '../../../ui/Badge';
import { FormSheet } from '../../../ui/FormSheet';
import { toast } from '../../../ui/Toast';
import type { ModTarget } from '../../student/commons/BoardCard';
import { useCommonsMod, useInbox, usePeopleMutations, type ModType } from '../queries';

// AF-04a: the moderation row (Edit · Hide/Unhide · Delete · Ban author) the student Commons cards show in admin mode.
const TARGET: Record<string, ModType> = { board: 'board-post', project: 'project', challenge: 'challenge' };

const stop = { onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(), onKeyDown: (e: { stopPropagation: () => void }) => e.stopPropagation() };

export function ModRow({ t, hidden, reportId }: { t: ModTarget; hidden?: boolean; reportId?: string }) {
  const m = useCommonsMod();
  const { ban } = usePeopleMutations();
  const [form, setForm] = useState<'edit' | 'ban'>();
  const busy = m.edit.isPending || m.hide.isPending || m.unhide.isPending || m.remove.isPending;
  const run = (p: Promise<unknown>, msg: string) => p.then(() => toast(msg), (e: Error) => toast(e.message));
  const profile = t.type === 'profile';
  return (
    <div className="acts" style={{ marginTop: 'var(--s2)' }} {...stop}>
      {hidden && <Badge kind="warn">Hidden</Badge>}
      <button type="button" className="btn sm" disabled={busy} onClick={() => setForm('edit')}>Edit</button>
      {!profile && (hidden
        ? <button type="button" className="btn sm" disabled={busy} onClick={() => run(m.unhide.mutateAsync(t), 'Shown again.')}>Unhide</button>
        : <button type="button" className="btn sm" disabled={busy || !reportId} title={reportId ? undefined : 'Hiding needs an open report; the API has no direct hide'}
            onClick={() => run(m.hide.mutateAsync(reportId!), 'Hidden.')}>Hide</button>)}
      {!profile && <button type="button" className="btn ghost sm" disabled={busy}
        onClick={() => { if (confirm(`Delete "${t.title}" for good?`)) run(m.remove.mutateAsync(t), 'Deleted.'); }}>Delete</button>}
      {t.authorId && <button type="button" className="btn ghost sm" disabled={busy} onClick={() => setForm('ban')}>Ban author</button>}
      {form === 'edit' && <FormSheet title={`Edit ${t.type.replace('-', ' ')}`} label="Save" onClose={() => setForm(undefined)}
        fields={profile ? [{ name: 'headline', label: 'Headline', value: t.text ?? '' }]
          : [{ name: 'title', label: 'Title', value: t.title, req: true }, { name: t.type === 'board-post' ? 'body' : 'description', label: 'Text', type: 'textarea', value: t.text ?? '' }]}
        onSubmit={async (v) => {
          const f = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, String(x)]));
          await m.edit.mutateAsync({ type: t.type, id: t.id, ...f });
          toast('Saved.');
        }} />}
      {form === 'ban' && <FormSheet title="Ban author from Commons" label="Ban" onClose={() => setForm(undefined)}
        fields={[{ name: 'reason', label: 'Reason (audited)', req: true }]}
        onSubmit={async (v) => { await ban.mutateAsync({ id: t.authorId, reason: String(v.reason).trim() }); toast('Banned from the Commons.'); }} />}
    </div>
  );
}

/** Open reports by target id, so a Hide button knows which report to resolve. */
export function useOpenReports() {
  const q = useInbox('reports', 'open');
  const map = new Map<string, string>();
  for (const i of q.data?.items ?? []) if (i.type === 'report' && TARGET[i.targetType]) map.set(i.targetId, i.id);
  return map;
}

const useDetail = (type: ModType, id: string) => useQuery({
  queryKey: ['commons', 'detail', type, id],
  queryFn: async (): Promise<ModTarget> => {
    const p = { params: { path: { id } } };
    if (type === 'board-post') { const d = await unwrap(api.GET('/commons/board-posts/{id}', p)); return { type, id, title: d.title, text: d.body, authorId: d.author.id }; }
    if (type === 'project') { const d = await unwrap(api.GET('/commons/projects/{id}', p)); return { type, id, title: d.title, text: d.description, authorId: d.members.find((x) => x.role === 'Owner')?.id ?? '' }; }
    const d = await unwrap(api.GET('/commons/challenges/{id}', p));
    return { type, id, title: d.title, text: d.description, authorId: d.owner.id };
  },
});

function HiddenItem({ type, id }: { type: ModType; id: string }) {
  const d = useDetail(type, id);
  return (
    <div className="card">
      <h4>{d.data?.title ?? (d.error ? 'Unavailable' : 'Loading…')}</h4>
      <p className="small muted">{type.replace('-', ' ')}</p>
      {d.data && <ModRow t={d.data} hidden />}
    </div>
  );
}

/** Items hidden by a resolved report. The feeds leave hidden items out for everyone, so the Inbox reports are the only index of them. */
export function HiddenList({ types }: { types: ModType[] }) {
  const q = useInbox('reports', 'hidden');
  const items = (q.data?.items ?? []).filter((i) => i.type === 'report' && types.includes(TARGET[i.targetType] as ModType));
  const seen = new Set<string>();
  const rows = items.flatMap((i) => (i.type === 'report' && !seen.has(i.targetId) && seen.add(i.targetId) ? [{ type: TARGET[i.targetType]!, id: i.targetId }] : []));
  if (!rows.length) return null;
  return (
    <div style={{ marginBottom: 'var(--s4)' }}>
      <h3 style={{ marginBottom: 'var(--s2)' }}>Hidden</h3>
      <div className="grid grid-2">{rows.map((r) => <HiddenItem key={r.id} {...r} />)}</div>
    </div>
  );
}
