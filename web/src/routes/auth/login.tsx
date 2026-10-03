import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { meQuery } from '../../api/hooks';
import { homeOf } from '../../router';
import { AuthCard } from './card';

export function Component() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await api.POST('/auth/login', { body: { email: String(f.get('email')), password: String(f.get('password')), client: 'web' } });
    // 401 "Email or password is wrong", 429, network: the server's message, inline.
    if (error) {
      setBusy(false);
      return setErr(error.message);
    }
    // Refetch, don't trust the cache: the guard would otherwise serve the cached null.
    const me = await qc.fetchQuery({ ...meQuery, staleTime: 0 });
    if (!me) {
      setBusy(false);
      return setErr('Something went wrong. Try again.');
    }
    navigate(homeOf(me), { replace: true });
  }

  return (
    <AuthCard>
      <form className="stack" onSubmit={submit}>
        <h3>Log in</h3>
        <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>
        <div className="field"><label htmlFor="pw">Password</label><input className="input" id="pw" name="password" type="password" autoComplete="current-password" required /></div>
        <p className="err" role="alert">{err}</p>
        <button className="btn primary block" disabled={busy}>Log in</button>
        <p className="small" style={{ textAlign: 'center' }}><Link to="/forgot">Forgot password?</Link></p>
      </form>
    </AuthCard>
  );
}
