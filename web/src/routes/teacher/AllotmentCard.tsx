import { toast } from '../../ui/Toast';
import { useAllotmentReply, useAllotments } from './queries';

// D7: the CR picked me as a subject's teacher. "Not me" unassigns me and tells the CR.
export function AllotmentCards() {
  const { data } = useAllotments();
  const reply = useAllotmentReply();
  if (!data?.length) return null;
  const send = (id: string, decline?: { classId: string; subjectId: string }) =>
    reply.mutate({ id, decline }, { onError: (e) => toast(e.message), onSuccess: () => decline && toast('Removed. The CR has been told.') });
  return (
    <div className="stack">{data.map((n) => {
      const { classId, subjectId } = n.payload as { classId?: string; subjectId?: string };
      return (
        <div key={n.id} className="card row between wrap" style={{ gap: 'var(--s2)' }}>
          <p className="grow">{n.text}</p>
          <div className="row" style={{ gap: 'var(--s1)' }}>
            <button type="button" className="btn primary sm" disabled={reply.isPending} onClick={() => send(n.id)}>Got it</button>
            {classId && subjectId && <button type="button" className="btn sm" disabled={reply.isPending} onClick={() => send(n.id, { classId, subjectId })}>Not me</button>}
          </div>
        </div>
      );
    })}</div>
  );
}
