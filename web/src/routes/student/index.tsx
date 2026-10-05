import { Outlet } from 'react-router';
import { useMe } from '../../api/hooks';
import { AppShell, type NavItem } from '../../ui/AppShell';

// FS-09: the student area layout (PROTO student.html:67-86); pages render into the Outlet.
const NAV: NavItem[] = [
  { to: '/s', label: 'Today', icon: 'home' },
  { to: '/s/class', label: 'Class', icon: 'class' },
  { to: '/s/commons', label: 'Commons', icon: 'spark' },
  { to: '/s/me', label: 'Me', icon: 'user' },
];

export function Component() {
  const { data: me } = useMe();
  return (
    <AppShell personality="student" nav={NAV} isAdmin={me?.user.isAdmin}>
      <Outlet />
    </AppShell>
  );
}
