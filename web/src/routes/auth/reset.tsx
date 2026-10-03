import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { toast } from '../../ui/Toast';
import { AuthCard } from './card';

// PROTO index.html:177-179.
export const checkPassword = (a: string, b: string) =>
  a.length < 8 ? 'Use at least 8 characters.' : a !== b ? 'The two passwords do not match.' : '';

export function Component() {
  const { token = '' } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [err, setErr] = useState<ReactNode>('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get('password'));
    const msg = checkPassword(password, String(f.get('confirm')));
    setErr(msg);
    if (msg) return;
    setBusy(true);
    const { error, response } = await api.POST('/auth/reset', { body: { token, password } });
    setBusy(false);
    if (error)
      return setErr(response?.status === 410 ? <>This reset link has expired, <Link to="/forgot" style={{ color: 'inherit', textDecoration: 'underline' }}>ask for a new one</Link>.</> : error.message);
    // Reset logs out every session and doesn't start one, so drop the cached user and log in fresh.
    qc.removeQueries({ queryKey: ['me'] });
    toast('Password changed. Log in with your new one.');
    navigate('/login', { replace: true });
  }

  return (
    <AuthCard>
      <form className="stack" onSubmit={submit} noValidate>
        <h3>Set a new password</h3>
        <div className="field"><label htmlFor="pw">Password</label><input className="input" id="pw" name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" /></div>
        <div className="field"><label htmlFor="pw2">Confirm password</label><input className="input" id="pw2" name="confirm" type="password" autoComplete="new-password" /></div>
        <p className="err" role="alert">{err}</p>
        <button className="btn primary block" disabled={busy}>Set password</button>
      </form>
    </AuthCard>
  );
}
