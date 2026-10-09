import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Notifications } from '../routes/student/me/Notifications';
import { Icon, type IconName } from './Icon';
import { Sheet } from './Sheet';

export type NavItem = { to: string; label: string; icon: IconName };
export type Personality = 'student' | 'teacher' | 'admin';
const BODY: Record<Personality, string> = { student: 'student', teacher: 'teacher', admin: 'teacher admin' };

// ponytail: untyped fetch until FS-05; swap for the typed client then. Any failure (CS-12 not built, offline) = 0.
export const unreadQuery = {
  queryKey: ['notifications', 'unread'],
  queryFn: async (): Promise<number> => {
    try {
      const r = await fetch('/api/v1/me/notifications', { credentials: 'include' });
      return r.ok ? ((await r.json()).unreadCount ?? 0) : 0;
    } catch {
      return 0;
    }
  },
  refetchInterval: 30_000,
};

/**
 * Rail (≥861px) / bottom nav (≤860px) + main, per PROTO student.html:67-86, teacher.html:79-106, admin.html:20-46.
 * nav[0] is the area home and only matches its exact path; the rest stay active on sub-routes.
 * `fab` = the mobile FAB, plus the rail "New post" button for teachers.
 */
export function AppShell({ personality, nav, railFooter, fab, isAdmin, onBell, children }: {
  personality: Personality;
  nav: readonly NavItem[];
  railFooter?: ReactNode;
  fab?: { label: string; onClick: () => void };
  isAdmin?: boolean;
  onBell?: () => void;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [bellOpen, setBellOpen] = useState(false);
  const { data: unread = 0 } = useQuery(unreadQuery);

  useEffect(() => {
    document.body.className = BODY[personality];
    return () => void (document.body.className = '');
  }, [personality]);

  const logout = async (e: MouseEvent) => {
    e.preventDefault();
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    qc.clear(); // drop the cached `me` so the area guards re-check
    navigate('/login');
  };
  const out = (className?: string) => <a className={className} href="/login" onClick={logout}>Log out</a>;
  const other = personality === 'admin' ? <Link to="/t">Teacher app</Link> : isAdmin ? <Link to="/a">Admin</Link> : null;
  const links = <>{other}{other && ' · '}{out()}</>;
  const teacher = personality === 'teacher';

  const items = nav.map(({ to, label, icon }, i) => (
    <NavLink key={to} to={to} end={i === 0} className={({ isActive }) => (isActive ? 'nav-item on' : 'nav-item')}>
      <Icon name={icon} /><span>{label}</span>
    </NavLink>
  ));

  return (
    <>
      <div className="app">
        <aside className="rail">
          <div className="brand"><span className="dot" />{personality === 'admin' ? 'Admin' : 'Digital Campus'}</div>
          <nav aria-label="Main" className={teacher ? 'stack' : undefined} style={teacher ? { gap: 'var(--s0)' } : undefined}>{items}</nav>
          {fab && teacher && (
            <button type="button" className="btn primary block newpost" onClick={fab.onClick}><Icon name="plus" /> {fab.label}</button>
          )}
          {personality === 'student' ? (
            <div className="foot railfoot">{railFooter}{out()}</div>
          ) : personality === 'admin' ? (
            <div className="foot">{railFooter}<Link className="foot-link" to="/t">Teacher app</Link>{out('foot-link')}</div>
          ) : (
            <div className="foot">{railFooter}<div className="note tiny">{links}</div></div>
          )}
        </aside>
        <main className="main">
          <div className="topbar">
            <button type="button" className="icon-btn bell" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} onClick={onBell ?? (personality === 'student' ? undefined : () => setBellOpen(true))}>
              <Icon name="bell" />{unread > 0 && <b>{unread}</b>}
            </button>
          </div>
          {children}
          {bellOpen && <Sheet title="Notifications" onClose={() => setBellOpen(false)}><Notifications sheet onNavigate={() => setBellOpen(false)} /></Sheet>}
          {personality !== 'student' && <div className="only-m tiny muted">{railFooter}{links}</div>}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Main">{items}</nav>
      {fab && (
        <button type="button" className="btn primary fab" onClick={fab.onClick}>
          <Icon name="plus" size={personality === 'student' ? 16 : 20} /> {fab.label}
        </button>
      )}
    </>
  );
}
