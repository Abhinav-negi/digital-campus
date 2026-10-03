// The auth pages' frame: PROTO index.html's brand mark + `.card.lift.demo` (the invite demo card, :100),
// on the neutral landing palette (body.landing gives `.demo`, `.err`, `input[readonly]`). FS-07 reuses it.
import { useEffect, type ReactNode } from 'react';

export function AuthCard({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.className = 'landing';
    return () => void (document.body.className = '');
  }, []);

  return (
    <main className="wrap" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'var(--s5) var(--s2)' }}>
      <div className="brand" style={{ justifyContent: 'center', marginBottom: 'var(--s5)' }}><span className="dot"></span>Digital Campus</div>
      <div className="card lift demo" style={{ width: '100%' }}>{children}</div>
    </main>
  );
}
