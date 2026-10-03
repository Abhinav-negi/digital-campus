// Dev-only FS-04 demo: /ui/shell/student | /ui/shell/teacher | /ui/shell/admin
import { useParams } from 'react-router';
import { AppShell, type NavItem, type Personality } from './AppShell';

const NAV: Record<Personality, [string, string, NavItem['icon']][]> = {
  student: [['', 'Today', 'home'], ['class', 'Class', 'class'], ['commons', 'Commons', 'spark'], ['me', 'Me', 'user']],
  teacher: [['', 'Today', 'home'], ['classes', 'Classes', 'class'], ['upcoming', 'Upcoming', 'calendar']],
  admin: [['', 'Teachers', 'people'], ['reports', 'Reports', 'flag'], ['featured', 'Featured', 'star']],
};

export function Component() {
  const p = (useParams().p ?? 'student') as Personality;
  const base = `/ui/shell/${p}`;
  return (
    <AppShell
      personality={p}
      isAdmin
      nav={NAV[p].map(([to, label, icon]) => ({ to: to ? `${base}/${to}` : base, label, icon }))}
      railFooter={p === 'teacher' && <div className="note tiny">Student Commons is private to students.</div>}
      fab={p === 'admin' ? undefined : { label: p === 'student' ? 'Post' : 'New post', onClick: () => {} }}
    >
      <div className="page-head">
        <div>
          <h1>Shell demo</h1>
          <p className="muted">personality: {p}</p>
        </div>
      </div>
    </AppShell>
  );
}
