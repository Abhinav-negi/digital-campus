import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import type { paths } from '../../../api/schema';
import { Sheet } from '../../../ui/Sheet';
import { toast } from '../../../ui/Toast';

type Body = NonNullable<paths['/commons/reports']['post']['requestBody']>['content']['application/json'];
export type ReportReason = Body['reason'];

/** One reason per button; the caller picks the reasons that target allows (e.g. "Academic dishonesty" is gigs only, the endpoint 422s otherwise). */
export function ReportSheet({ title, targetType, targetId, reasons, onClose }: {
  title: string; targetType: Body['targetType']; targetId: string; reasons: readonly ReportReason[]; onClose: () => void;
}) {
  const send = useMutation({
    mutationFn: (reason: ReportReason) => unwrap(api.POST('/commons/reports', { body: { targetType, targetId, reason } })),
    onSuccess: () => { toast('Reported. An admin will review it.'); onClose(); },
    onError: (e) => toast(e.message),
  });
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="stack">
        {reasons.map((r) => <button key={r} type="button" className="btn block" disabled={send.isPending} onClick={() => send.mutate(r)}>{r}</button>)}
      </div>
    </Sheet>
  );
}
