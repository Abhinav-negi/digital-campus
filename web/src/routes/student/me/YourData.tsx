import { useState } from 'react';
import { api, unwrap } from '../../../api/client';
import { FormSheet } from '../../../ui/FormSheet';
import { toast } from '../../../ui/Toast';

export function YourData() {
  const [del, setDel] = useState(false);
  async function exportData() {
    try {
      const data = await unwrap(api.GET('/me/export'));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      a.download = 'my-campus-data.json';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { toast(e instanceof Error ? e.message : (e as { message: string }).message); }
  }
  return (
    <>
      <div className="fl">
        <button type="button" className="btn" onClick={exportData}>Export my data</button>
        <button type="button" className="btn" onClick={() => setDel(true)}><span className="danger-text">Delete account</span></button>
      </div>
      {del && <FormSheet title="Delete account" label="Delete my account" onClose={() => setDel(false)}
        fields={[
          { type: 'note', label: 'This removes your Commons content and anonymises your name. Attendance records stay. It cannot be undone.' },
          { name: 'password', label: 'Confirm with your password', type: 'password', req: true },
        ]}
        onSubmit={async (v) => {
          await unwrap(api.DELETE('/me', { body: { password: String(v.password) } }));
          location.assign('/login');
        }} />}
    </>
  );
}
