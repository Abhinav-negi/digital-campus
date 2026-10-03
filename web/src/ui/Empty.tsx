import type { ReactNode } from 'react';
import { notionists } from './Avatar';

/** Illustrated empty state: a notionists drawing seeded by context above one kind sentence. */
export function Empty({ seed = 'calm', text, action, cr }: { seed?: string; text?: ReactNode; action?: ReactNode; cr?: boolean }) {
  return (
    <div className={cr ? 'empty cr' : 'empty'}>
      <img alt="" src={notionists(seed, false)} />
      {text && <p>{text}</p>}
      {action && <div style={{ marginTop: 'var(--s2)' }}>{action}</div>}
    </div>
  );
}

/** D9 placeholder. Everyone sees "Your CR will add the {what} soon."; the CR (isCr) sees an "Add {what}" button instead. */
export function CrWillAdd({ what, isCr, onAdd }: { what: string; isCr?: boolean; onAdd?: () => void }) {
  return isCr
    ? <Empty cr seed={what} action={<button type="button" className="btn primary" onClick={onAdd}>Add {what}</button>} />
    : <Empty cr seed={what} text={`Your CR will add the ${what} soon.`} />;
}
