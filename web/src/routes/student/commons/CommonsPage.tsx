import { useState } from 'react';
import { NavLink, useParams } from 'react-router';
import { Empty } from '../../../ui/Empty';
import { Icon } from '../../../ui/Icon';
import { Board } from './Board';
import { Compose } from './Compose';
import { PostSheet } from './PostSheet';

const TABS = [['', 'Board'], ['build', 'Build'], ['people', 'People']] as const;

export function Component() {
  const tab = useParams()['*'] ?? '';
  const [composing, setComposing] = useState(false);
  const [openId, setOpenId] = useState<string>();
  const post = (cls: string) => <button type="button" className={`btn primary ${cls}`} onClick={() => setComposing(true)}><Icon name="plus" size={16} /> Post</button>;

  return (
    <>
      <div className="page-head">
        <div><h1>Commons</h1><p className="muted">Every student here: all branches, all years, one place.</p></div>
        {post('hpost')}
      </div>
      <div className="tabs">{TABS.map(([k, label]) => (
        <NavLink key={k} to={k} end className={({ isActive }) => (isActive ? 'tab on' : 'tab')}>{label}</NavLink>))}
      </div>
      <p className="small muted" style={{ marginTop: 'var(--s2)' }}>Admins can see Commons activity, including messages, for safety.</p>
      <div style={{ marginTop: 'var(--s4)' }}>
        {tab === '' && <Board onOpen={setOpenId} />}
        {tab === 'build' && <Empty text="Build is coming soon." />}
        {tab === 'people' && <Empty text="People is coming soon." />}
      </div>
      {post('fab')}
      {openId && <PostSheet id={openId} onClose={() => setOpenId(undefined)} />}
      {composing && <Compose onClose={() => setComposing(false)} />}
    </>
  );
}
