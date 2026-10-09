import { NavLink, useParams } from 'react-router';
import { Board } from '../../student/commons/Board';
import type { Moderation } from '../../student/commons/BoardCard';
import { BuildPage } from '../../student/commons/build/BuildPage';
import { People } from '../../student/commons/people/People';
import { HiddenList, ModRow, useOpenReports } from './Moderation';

const TABS = [['', 'Board'], ['build', 'Build'], ['people', 'People'], ['conversations', 'Conversations'], ['featured', 'Featured']] as const;

// AF-04a: Commons for admins (ARCH D2, PROTO admin.html:101-108). Board/Build/People are the student views plus a moderation row.
export function Component() {
  const tab = useParams()['*'] ?? '';
  const reports = useOpenReports();
  const moderation: Moderation = (t) => <ModRow t={t} reportId={reports.get(t.id)} />;
  return (
    <>
      <div className="page-head"><div><h1>Commons</h1><p className="muted">Moderate posts, projects and people. Hiding needs an open report.</p></div></div>
      <div className="tabs">{TABS.map(([k, label]) => (
        <NavLink key={k} to={k} end className={({ isActive }) => (isActive ? 'tab on' : 'tab')}>{label}</NavLink>))}
      </div>
      <div style={{ marginTop: 'var(--s4)' }}>
        {tab === '' && <><HiddenList types={['board-post']} /><Board moderation={moderation} /></>}
        {tab === 'build' && <><HiddenList types={['project', 'challenge']} /><BuildPage moderation={moderation} /></>}
        {tab === 'people' && <People moderation={moderation} />}
        {(tab === 'conversations' || tab === 'featured') && <p className="muted">Coming in AF-04b.</p>}
      </div>
    </>
  );
}
