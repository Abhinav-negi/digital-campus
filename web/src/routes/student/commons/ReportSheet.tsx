import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import { Sheet } from '../../../ui/Sheet';
import { toast } from '../../../ui/Toast';

/** "Academic dishonesty" is gigs only (the endpoint 422s otherwise). */
export function ReportSheet({ postId, kind, onClose }: { postId: string; kind: string; onClose: () => void }) {
  const send = useMutation({
    mutationFn: (reason: 'Spam' | 'Unsafe or prohibited' | 'Academic dishonesty' | 'Other') =>
      unwrap(api.POST('/commons/reports', { body: { targetType: 'board', targetId: postId, reason } })),
    onSuccess: () => { toast('Reported. An admin will review it.'); onClose(); },
    onError: (e) => toast(e.message),
  });
  const reasons = ['Spam', 'Unsafe or prohibited', ...(kind === 'gig' ? ['Academic dishonesty' as const] : []), 'Other'] as const;
  return (
    <Sheet title="Report this post" onClose={onClose}>
      <div className="stack">
        {reasons.map((r) => <button key={r} type="button" className="btn block" disabled={send.isPending} onClick={() => send.mutate(r)}>{r}</button>)}
      </div>
    </Sheet>
  );
}
