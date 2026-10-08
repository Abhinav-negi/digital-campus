import { useState } from 'react';
import { Avatar } from '../../../ui/Avatar';
import { FormSheet } from '../../../ui/FormSheet';
import { Sheet } from '../../../ui/Sheet';
import { toast } from '../../../ui/Toast';
import { useAllClasses, usePeopleMutations, type AdminUser } from '../queries';

// AF-02: one person. Edit (students), move batch, disable/enable, reset password, admin badge, Commons ban, delete.
export function UserSheet({ user: u, onClose }: { user: AdminUser; onClose: () => void }) {
  const m = usePeopleMutations();
  const student = u.role === 'student';
  const [form, setForm] = useState<'edit' | 'move' | 'ban'>();
  const classes = useAllClasses(form === 'move');
  const busy = Object.values(m).some((x) => x.isPending);
  const run = <T,>(p: Promise<T>, msg: string, close?: boolean) => p.then(() => { toast(msg); if (close) onClose(); }, (e: Error) => toast(e.message));
  const chiefTip = u.isChief ? 'The chief admin cannot be changed' : undefined;
  return (
    <>
      <Sheet title={u.name} onClose={onClose}>
        <div className="stack">
          <div className="row"><Avatar user={u} size="lg" />
            <div className="grow"><p>{u.email}</p>
              <p className="muted small">{student ? `${u.homeClass?.name ?? 'No class'}${u.studentIdNo ? ` · ${u.studentIdNo}` : ''}` : u.dept} · {u.status}{u.lastLoginAt ? ` · last login ${new Date(u.lastLoginAt).toLocaleDateString()}` : ''}</p></div></div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {student && <button type="button" className="btn sm" disabled={busy} onClick={() => setForm('edit')}>Edit details</button>}
            {student && <button type="button" className="btn sm" disabled={busy} onClick={() => setForm('move')}>Move to batch</button>}
            {u.status !== 'invited' && (
              <button type="button" className="btn sm" disabled={busy || u.isChief} title={chiefTip}
                onClick={() => run(m.status.mutateAsync({ id: u.id, status: u.status === 'disabled' ? 'active' : 'disabled' }), u.status === 'disabled' ? 'Enabled.' : 'Disabled.')}>
                {u.status === 'disabled' ? 'Enable' : 'Disable'}</button>)}
            {u.status === 'active' && <button type="button" className="btn sm" disabled={busy} onClick={() => run(m.reset.mutateAsync(u.id), 'Reset link sent.')}>Reset password</button>}
            {!student && (
              <button type="button" className="btn sm" disabled={busy || u.isChief} title={chiefTip}
                onClick={() => run(m.admin.mutateAsync({ id: u.id, isAdmin: !u.isAdmin }), u.isAdmin ? 'Admin removed.' : 'Admin granted.')}>
                {u.isAdmin ? 'Remove admin' : 'Make admin'}</button>)}
            {student && <button type="button" className="btn sm" disabled={busy} onClick={() => setForm('ban')}>Ban from Commons</button>}
            {student && <button type="button" className="btn sm" disabled={busy} onClick={() => run(m.unban.mutateAsync(u.id), 'Unbanned.')}>Unban</button>}
            <button type="button" className="btn ghost sm" disabled={busy || u.isChief} title={chiefTip}
              onClick={() => { if (confirm(`Delete ${u.name} for good? Their account is anonymised and their Commons content removed. This cannot be undone.`)) run(m.remove.mutateAsync(u.id), 'Account deleted.', true); }}>Delete</button>
          </div>
        </div>
      </Sheet>
      {form === 'edit' && <FormSheet title="Edit details" label="Save" onClose={() => setForm(undefined)}
        fields={[{ name: 'name', label: 'Name', value: u.name, req: true }, { name: 'studentIdNo', label: 'Student ID', value: u.studentIdNo ?? '', req: true }, { name: 'email', label: 'Email', type: 'email', value: u.email, req: true }]}
        onSubmit={async (v) => { await m.edit.mutateAsync({ id: u.id, name: String(v.name).trim(), studentIdNo: String(v.studentIdNo).trim(), email: String(v.email).trim() }); toast('Saved.'); }} />}
      {form === 'move' && (classes.data
        ? <FormSheet title="Move to batch" label="Move" onClose={() => setForm(undefined)}
            fields={[{ name: 'classId', label: 'Batch', type: 'select', options: classes.data.filter((c) => c.id !== u.homeClass?.id).map((c) => [c.id, c.name] as const) }]}
            onSubmit={async (v) => { await m.move.mutateAsync({ id: u.id, classId: String(v.classId) }); toast('Moved.'); }} />
        : <Sheet title="Move to batch" onClose={() => setForm(undefined)}><p className="muted">{classes.error ? classes.error.message : 'Loading…'}</p></Sheet>)}
      {form === 'ban' && <FormSheet title="Ban from Commons" label="Ban" onClose={() => setForm(undefined)}
        fields={[{ name: 'reason', label: 'Reason (audited)', req: true }]}
        onSubmit={async (v) => { await m.ban.mutateAsync({ id: u.id, reason: String(v.reason).trim() }); toast('Banned from the Commons.'); }} />}
    </>
  );
}
