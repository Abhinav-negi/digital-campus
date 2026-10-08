import { useState } from 'react';
import { toast } from '../../ui/Toast';
import { FormSheet } from '../../ui/FormSheet';
import { useAdminBranches, useBranchMutations, useInstitution, useInstitutionPatch } from './queries';

// AF-05: institution name + timezone, branches (add / rename / delete if unused). ARCH D2, AD-04.
export function Component() {
  const inst = useInstitution();
  const patch = useInstitutionPatch();
  const branches = useAdminBranches();
  const m = useBranchMutations();
  const [sheet, setSheet] = useState<'add' | { id: string; code: string; name: string }>();
  const fail = (e: Error) => toast(e.message);
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  const tz = inst.data?.timezone ?? '';
  return (
    <>
      <div className="page-head"><div><h1>School</h1><p className="muted">Institution details and branches. Changes show up in the new-class wizard straight away.</p></div></div>
      <form className="card stack" key={inst.data?.id ?? 'x'} onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        patch.mutate({ name: String(fd.get('name')).trim(), timezone: String(fd.get('timezone')) }, { onSuccess: () => toast('Saved.'), onError: fail });
      }}>
        <div className="field"><label htmlFor="sn">Institution name</label>
          <input id="sn" name="name" className="input" required defaultValue={inst.data?.name ?? ''} /></div>
        <div className="field"><label htmlFor="stz">Timezone</label>
          <input id="stz" name="timezone" className="input" list="tzs" required defaultValue={tz} />
          <datalist id="tzs">{zones.map((z) => <option key={z} value={z} />)}</datalist></div>
        <div><button className="btn primary" disabled={!inst.data || patch.isPending}>Save</button></div>
      </form>
      {inst.error && <p className="muted">{inst.error.message}</p>}
      <div className="page-head" style={{ marginTop: 'var(--s4)' }}><h2>Branches</h2>
        <button type="button" className="btn primary" onClick={() => setSheet('add')}>Add branch</button></div>
      {branches.error && <p className="muted">{branches.error.message}</p>}
      <div className="list">
        {branches.data?.map((b) => (
          <div key={b.id} className="row-item">
            <div className="grow"><h4>{b.code} · {b.name}</h4><p className="muted tiny">{b.classCount} {b.classCount === 1 ? 'class' : 'classes'}</p></div>
            <div className="acts">
              <button type="button" className="btn sm" onClick={() => setSheet(b)}>Rename</button>
              <button type="button" className="btn ghost sm" disabled={b.classCount > 0 || m.remove.isPending} title={b.classCount ? 'In use by a class' : undefined}
                onClick={() => { if (confirm(`Delete ${b.code}?`)) m.remove.mutate(b.id, { onSuccess: () => toast('Branch deleted.'), onError: fail }); }}>Delete</button>
            </div>
          </div>))}
      </div>
      {sheet === 'add' && <FormSheet title="Add branch" label="Add" onClose={() => setSheet(undefined)}
        fields={[{ name: 'code', label: 'Code (e.g. CSE)', req: true }, { name: 'name', label: 'Name', req: true }]}
        onSubmit={async (v) => { await m.add.mutateAsync({ code: String(v.code).trim(), name: String(v.name).trim() }); toast('Branch added.'); }} />}
      {sheet && sheet !== 'add' && <FormSheet title="Rename branch" label="Save" onClose={() => setSheet(undefined)}
        fields={[{ name: 'code', label: 'Code', value: sheet.code, req: true }, { name: 'name', label: 'Name', value: sheet.name, req: true }]}
        onSubmit={async (v) => { await m.rename.mutateAsync({ id: sheet.id, code: String(v.code).trim(), name: String(v.name).trim() }); toast('Branch updated.'); }} />}
    </>
  );
}
