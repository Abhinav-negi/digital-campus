import { useState } from 'react';
import { Badge } from '../../../ui/Badge';
import { FormSheet } from '../../../ui/FormSheet';
import { toast } from '../../../ui/Toast';
import type { ModTarget } from '../../student/commons/BoardCard';
import { useCommonsMod, usePeopleMutations } from '../queries';

// AF-04a: the moderation row (Edit · Hide/Unhide · Delete · Ban author) the student Commons cards show in admin mode.
const stop = { onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(), onKeyDown: (e: { stopPropagation: () => void }) => e.stopPropagation() };

export function ModRow({ t }: { t: ModTarget }) {
  const m = useCommonsMod();
  const { ban } = usePeopleMutations();
  const [form, setForm] = useState<'edit' | 'ban'>();
  const busy = m.edit.isPending || m.hide.isPending || m.unhide.isPending || m.remove.isPending;
  const run = (p: Promise<unknown>, msg: string) => p.then(() => toast(msg), (e: Error) => toast(e.message));
  const profile = t.type === 'profile';
  const hidden = t.hidden;
  return (
    <div className="acts" style={{ marginTop: 'var(--s2)' }} {...stop}>
      {hidden && <Badge kind="warn">Hidden</Badge>}
      <button type="button" className="btn sm" disabled={busy} onClick={() => setForm('edit')}>Edit</button>
      {!profile && (hidden
        ? <button type="button" className="btn sm" disabled={busy} onClick={() => run(m.unhide.mutateAsync(t), 'Shown again.')}>Unhide</button>
        : <button type="button" className="btn sm" disabled={busy} onClick={() => run(m.hide.mutateAsync(t), 'Hidden.')}>Hide</button>)}
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

