import { useState } from 'react';
import { FormSheet } from '../../ui/FormSheet';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import { useSessionChange, type TodaySession } from './queries';

// "⋯" on an own session: Cancel (note) · Postpone (later today, or another date + time + room) → POST /classes/:id/changes.
export function SessionActions({ s, date }: { s: TodaySession; date: string }) {
  const [step, setStep] = useState<'closed' | 'menu' | 'cancel' | 'postpone'>('closed');
  const change = useSessionChange(s.classId);
  const close = () => setStep('closed');
  if (!s.slotId) return null;
  const slotId = s.slotId;
  const name = s.subject?.name ?? s.title ?? 'Class';
  return (
    <>
      <button type="button" className="btn ghost sm" aria-label="More actions" onClick={() => setStep('menu')}>⋯</button>
      {step === 'menu' && (
        <Sheet title={name} onClose={close}>
          <div className="stack">
            <button type="button" className="btn block" onClick={() => setStep('postpone')}>Postpone</button>
            <button type="button" className="btn block" onClick={() => setStep('cancel')}>Cancel this session</button>
          </div>
        </Sheet>
      )}
      {step === 'cancel' && (
        <FormSheet title={`Cancel ${name}?`} label="Cancel session" onClose={close}
          fields={[{ type: 'note', label: 'Students see a cancelled banner on their Today.' }, { name: 'note', label: 'Note for students', type: 'textarea', ph: 'e.g. Faculty meeting' }]}
          onSubmit={async (v) => { await change.mutateAsync({ date, kind: 'cancelled', slotId, note: String(v.note) || undefined }); toast('Session cancelled · students notified'); }} />
      )}
      {step === 'postpone' && (
        <FormSheet title={`Postpone ${name}`} label="Postpone" onClose={close}
          fields={[
            { type: 'note', label: 'Later today: keep the date and change the time. Another day: pick the date, time and room.' },
            { name: 'movedTo', label: 'New date', type: 'date', value: date, req: true },
            { name: 'start', label: 'New start', type: 'time', value: s.start, req: true },
            { name: 'end', label: 'New end', type: 'time', value: s.end, req: true },
            { name: 'room', label: 'Room', value: s.room ?? '' },
            { name: 'note', label: 'Note for students', type: 'textarea' },
          ]}
          onSubmit={async (v) => {
            const movedTo = String(v.movedTo);
            await change.mutateAsync({ date, kind: 'moved', slotId, start: String(v.start), end: String(v.end),
              room: String(v.room) || undefined, movedToDate: movedTo !== date ? movedTo : undefined, note: String(v.note) || undefined });
            toast('Session moved · students notified');
          }} />
      )}
    </>
  );
}
