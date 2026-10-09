import { Link } from 'react-router';
import { useMe } from '../api/hooks';
import { homeOf } from '../router';

// SPEC §15 step 7: the wall. A logged-in user in the wrong area lands here (guards in router.tsx); logged-out users go to /login.
export function Component() {
  const { data: me, isLoading } = useMe();
  if (!isLoading && !me) return <Link to="/login">Log in</Link>;
  return (
    <main className="main" style={{ maxWidth: 480, margin: 'var(--s6, 3rem) auto', padding: 'var(--s3)' }}>
      <h1>403</h1>
      <p className="muted">This area is not for your account.</p>
      <Link className="btn primary" to={me ? homeOf(me) : '/'}>Go to your home</Link>
    </main>
  );
}
