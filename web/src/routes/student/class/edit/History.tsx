import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../../../../api/client';

const LABEL: Record<string, string> = { create: 'Added', update: 'Edited', delete: 'Removed' };

/** "board.notice.create" -> "Added notice" */
const label = (action: string) => {
  const [, kind, verb] = action.split('.');
  return `${LABEL[verb ?? ''] ?? verb} ${kind}`;
};

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 6e4));
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : m < 2880 ? 'yesterday' : `${Math.round(m / 1440)} days ago`;
};

/** CR "Edit history" card: the last 6 board changes (CS-07 history). */
export function History({ classId }: { classId: string }) {
  const q = useQuery({
    queryKey: ['classes', classId, 'history'],
    queryFn: () => unwrap(api.GET('/classes/{id}/history', { params: { path: { id: classId }, query: { limit: 6 } } })),
  });
  return (
    <div className="section">
      <div className="row between"><h3>Edit history</h3></div>
      <div className="card"><div className="list">
        {q.data?.items.length === 0 && <p className="small muted">No changes yet.</p>}
        {q.data?.items.map((h) => {
          const snap = (h.after ?? h.before) as { title?: string } | null;
          return (
            <div className="small" key={h.id}>
              <b>{h.actor.name}</b> · {label(h.action)}{snap?.title ? ` · ${snap.title}` : ''}
              <div className="tiny muted">{ago(h.createdAt)}</div>
            </div>
          );
        })}
      </div></div>
    </div>
  );
}
