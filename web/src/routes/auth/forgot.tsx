import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api } from '../../api/client';
import { AuthCard } from './card';

export function Component() {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const { error } = await api.POST('/auth/forgot', { body: { email: String(new FormData(e.currentTarget).get('email')) } });
    setBusy(false);
    // Always the same answer (the server never says whether the email exists); only 429/network show.
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <AuthCard>
      {sent ? (
        <div className="stack">
          <h3>Check your email</h3>
          <p className="muted">If that email exists, we sent a link. It expires in an hour.</p>
          <Link className="btn primary block" to="/login">Back to log in</Link>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <h3>Forgot password</h3>
          <p className="muted small">Enter your email and we'll send you a link to set a new one.</p>
          <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>
          <p className="err" role="alert">{err}</p>
          <button className="btn primary block" disabled={busy}>Send link</button>
          <p className="small" style={{ textAlign: 'center' }}><Link to="/login">Back to log in</Link></p>
        </form>
      )}
    </AuthCard>
  );
}
