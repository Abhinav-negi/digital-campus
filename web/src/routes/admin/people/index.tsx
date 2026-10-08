import { useState } from 'react';
import { Avatar } from '../../../ui/Avatar';
import { Badge, type BadgeKind } from '../../../ui/Badge';
import { Empty } from '../../../ui/Empty';
import { FormSheet } from '../../../ui/FormSheet';
import { toast } from '../../../ui/Toast';
import { useAdminBranches, useUsers, usePeopleMutations, type AdminUser, type PeopleFilters } from '../queries';
import { UserSheet } from './UserSheet';

const STATUS: Record<AdminUser['status'], BadgeKind> = { active: 'open', invited: 'warn', disabled: 'danger' };
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

// AF-02: people directory with filters, Add teacher, and the user sheet (ARCH D1-D4, PROTO admin.html:75-84).
export function Component() {
  const [q, setQ] = useState('');
  const [f, setF] = useState<Omit<PeopleFilters, 'q'>>({});
  const [open, setOpen] = useState<string>();
  const [adding, setAdding] = useState(false);
  const users = useUsers({ ...f, q: q.trim() || undefined });
  const branches = useAdminBranches();
  const m = usePeopleMutations();
  const items = users.data?.pages.flatMap((p) => p.items) ?? [];
  const opened = items.find((u) => u.id === open);
  const set = <K extends keyof typeof f>(k: K) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value || undefined });
  return (
    <>
      <div className="page-head"><div><h1>People</h1><p className="muted">Teachers and students. Open a person to manage their account.</p></div>
        <button type="button" className="btn primary" onClick={() => setAdding(true)}>Add teacher</button></div>
      <div className="row" style={{ flexWrap: 'wrap', margin: 'var(--s2) 0' }}>
        <input className="input grow" type="search" placeholder="Search name, email or student ID" aria-label="Search people" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" aria-label="Role" value={f.role ?? ''} onChange={set('role')}>
          <option value="">All roles</option><option value="staff">Teachers</option><option value="student">Students</option></select>
        <select className="input" aria-label="Branch" value={f.branchId ?? ''} onChange={set('branchId')}>
          <option value="">All branches</option>{branches.data?.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select>
        <select className="input" aria-label="Status" value={f.status ?? ''} onChange={set('status')}>
          <option value="">Any status</option><option value="active">Active</option><option value="invited">Invited</option><option value="disabled">Disabled</option></select>
      </div>
      {users.error && <p className="muted">{users.error.message}</p>}
      {users.data && !items.length && <Empty text="No one matches." />}
      <div className="list">
        {items.map((u) => (
          <div key={u.id} className="row-item" role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => setOpen(u.id)} onKeyDown={(e) => e.key === 'Enter' && setOpen(u.id)}>
            <Avatar user={u} />
            <div className="grow"><h4>{u.name} {u.isChief ? <Badge kind="focus">Chief</Badge> : u.isAdmin ? <Badge kind="questions">Admin</Badge> : null}</h4>
              <p className="muted small">{u.role === 'staff' ? `Teacher · ${u.dept ?? ''}` : `Student${u.homeClass ? ` · ${u.homeClass.name}` : ''}${u.studentIdNo ? ` · ${u.studentIdNo}` : ''}`} · {u.email}</p></div>
            <Badge kind={STATUS[u.status]}>{cap(u.status)}</Badge>
          </div>))}
      </div>
      {users.hasNextPage && <button type="button" className="btn block" disabled={users.isFetchingNextPage} onClick={() => users.fetchNextPage()}>Load more</button>}
      {opened && <UserSheet user={opened} onClose={() => setOpen(undefined)} />}
      {adding && <FormSheet title="Add teacher" label="Send invite" onClose={() => setAdding(false)}
        fields={[{ name: 'name', label: 'Name', req: true }, { name: 'email', label: 'Email', type: 'email', req: true }, { name: 'dept', label: 'Department', req: true }]}
        onSubmit={async (v) => { await m.invite.mutateAsync({ name: String(v.name).trim(), email: String(v.email).trim(), dept: String(v.dept).trim() }); toast('Invite sent.'); }} />}
    </>
  );
}
