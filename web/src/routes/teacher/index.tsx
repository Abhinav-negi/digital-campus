import { useState } from 'react';
import { Outlet } from 'react-router';
import { useMe } from '../../api/hooks';
import { AppShell, type NavItem } from '../../ui/AppShell';
import { Composer } from './Composer';

// FS-09: the teacher area layout (PROTO teacher.html:79-106); pages render into the Outlet.
const NAV: NavItem[] = [
  { to: '/t', label: 'Today', icon: 'home' },
  { to: '/t/classes', label: 'Classes', icon: 'class' },
  { to: '/t/upcoming', label: 'Upcoming', icon: 'calendar' },
];

export function Component() {
  const { data: me } = useMe();
  const [composing, setComposing] = useState(false);
  return (
    <AppShell
      personality="teacher"
      nav={NAV}
      isAdmin={me?.user.isAdmin}
      fab={{ label: 'New post', onClick: () => setComposing(true) }}
      railFooter={<div className="note tiny">Student Commons is private to students.</div>}
    >
      <Outlet />
      {composing && <Composer onClose={() => setComposing(false)} />}
    </AppShell>
  );
}
