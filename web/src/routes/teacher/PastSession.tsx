import { useNavigate } from 'react-router';
import { FormSheet } from '../../ui/FormSheet';
import { openAttendance, useMySubjects } from './queries';

const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

// PROTO teacher.html:288-294. The API only allows today or yesterday (non-admin), so date is a two-option select.
export function PastSession({ today, userId, onClose }: { today: string; userId: string; onClose: () => void }) {
  const go = useNavigate();
  const subjects = useMySubjects(userId).data ?? [];
  const yesterday = addDays(today, -1);
  return (
    <FormSheet title="Fill a past session" label="Continue" onClose={onClose}
      fields={[
        { type: 'note', label: 'For paper days. Pick the day and subject, then mark the absent as usual.' },
        { name: 'date', label: 'Date', type: 'select', value: yesterday, options: [[yesterday, 'Yesterday'], [today, 'Today']] },
        { name: 'subjectId', label: 'Subject', type: 'select', options: subjects.map((s) => [s.id, `${s.name} · ${s.className}`] as const) },
      ]}
      onSubmit={async (v) => {
        const s = await openAttendance({ subjectId: String(v.subjectId), date: String(v.date) });
        go(`/t/attend/${s.id}`);
      }} />
  );
}
