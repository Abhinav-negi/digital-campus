import { useState } from 'react';
import { NewClass } from '../../teacher/classes/NewClass';
import { useUsers } from '../queries';

// AF-03: create a class on behalf of a teacher: the TE-07 wizard + a class teacher picker (the class is handed over after creation).
export function Component() {
  const [id, setId] = useState('');
  const staff = useUsers({ role: 'staff', status: 'active' });
  const items = staff.data?.pages.flatMap((p) => p.items) ?? [];
  const slot = (
    <div className="field"><label htmlFor="nct">Class teacher</label>
      <select className="input" id="nct" value={id} onChange={(e) => setId(e.target.value)}>
        <option value="">Pick a teacher</option>{items.map((u) => <option key={u.id} value={u.id}>{u.name}{u.dept ? ` · ${u.dept}` : ''}</option>)}</select></div>
  );
  return <NewClass base="/a/classes" teacher={{ id, slot }} />;
}
