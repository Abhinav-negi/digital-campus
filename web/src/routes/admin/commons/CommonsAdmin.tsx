import { NavLink, useParams } from 'react-router';
import { Board } from '../../student/commons/Board';
import type { Moderation } from '../../student/commons/BoardCard';
import { BuildPage } from '../../student/commons/build/BuildPage';
import { People } from '../../student/commons/people/People';
import { Conversations } from './Conversations';
import { Featured } from './Featured';
import { ModRow } from './Moderation';

const TABS = [['', 'Board'], ['build', 'Build'], ['people', 'People'], ['conversations', 'Conversations'], ['featured', 'Featured']] as const;

// AF-04a: Commons for admins (ARCH D2, PROTO admin.html:101-108). Board/Build/People are the student views plus a moderation row.
export function Component() {
  const tab = useParams()['*'] ?? '';
  const moderation: Moderation = (t) => <ModRow t={t} />;
  return (
    <>
      <div className="page-head"><div><h1>Commons</h1><p className="muted">Moderate posts, projects and people.</p></div></div>
      <div className="tabs">{TABS.map(([k, label]) => (
        <NavLink key={k} to={`/a/commons${k ? '/' + k : ''}`} className={k === tab ? 'tab on' : 'tab'}>{label}</NavLink>))}
      </div>
      <div style={{ marginTop: 'var(--s4)' }}>
        {tab === '' && <Board moderation={moderation} />}
        {tab === 'build' && <BuildPage moderation={moderation} />}
        {tab === 'people' && <People moderation={moderation} />}
        {tab === 'conversations' && <Conversations />}
        {tab === 'featured' && <Featured />}
      </div>
    </>
  );
}
