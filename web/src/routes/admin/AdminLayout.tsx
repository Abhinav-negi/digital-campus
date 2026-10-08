import { Outlet } from 'react-router';
import { AppShell, type NavItem } from '../../ui/AppShell';

// AF-01: the admin area layout (PROTO admin.html:20-63); pages render into the Outlet.
const NAV: NavItem[] = [
  { to: '/a', label: 'Inbox', icon: 'chat' },
  { to: '/a/people', label: 'People', icon: 'people' },
  { to: '/a/classes', label: 'Classes', icon: 'class' },
  { to: '/a/commons', label: 'Commons', icon: 'star' },
  { to: '/a/school', label: 'School', icon: 'shield' },
  { to: '/a/audit', label: 'Audit', icon: 'file' },
];

export function Component() {
  return (
    <AppShell personality="admin" nav={NAV}>
      <Outlet />
    </AppShell>
  );
}
