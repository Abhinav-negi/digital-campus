import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { toast } from '../../../ui/Toast';

/** "Enter class code" card. ponytail: the API has no "is a code open?" signal for students, so the card is always shown and a wrong/expired code errors inline. */
export function CheckIn() {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    const r = await api.POST('/checkin', { body: { code: code.trim() } });
    setBusy(false);
    if (r.error) return setErr(r.error.message);
    setDone(r.data.subject.name); setCode('');
    toast("You're marked present");
    void qc.invalidateQueries({ queryKey: ['me'] });
  };
  if (done) return <div className="card tint"><b>You're marked present</b><div className="small muted">{done}</div></div>;
  return (
    <form className="card stack" onSubmit={submit} style={{ gap: 'var(--s2)' }}>
      <div className="eyebrow">Enter class code</div>
      <div className="row">
        <input className="input grow" inputMode="numeric" autoComplete="one-time-code" placeholder="4-digit code" aria-label="Class code" value={code} onChange={(e) => setCode(e.target.value)} />
        <button type="submit" className="btn primary" disabled={busy || !code.trim()}>Check in</button>
      </div>
      {err && <div className="small" role="alert" style={{ color: 'var(--danger)' }}>{err}</div>}
    </form>
  );
}
