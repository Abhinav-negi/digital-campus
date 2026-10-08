import { useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../../../api/client';
import { FormSheet } from '../../../../ui/FormSheet';
import { toast } from '../../../../ui/Toast';
import { today } from '../../../../lib/dates';

export function NewChallenge({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const week = new Date(); week.setDate(week.getDate() + 7);
  return (
    <FormSheet title="New challenge" label="Create challenge" onClose={onClose}
      fields={[
        { name: 'title', label: 'Title', req: true },
        { name: 'description', label: 'What should people do?', type: 'textarea', req: true },
        { name: 'endsAt', label: 'Ends on', type: 'date', value: today(week), req: true },
        { name: 'judging', label: 'Winner is picked by', type: 'select', options: [['likes', 'Most likes'], ['owner', 'Me']] },
      ]}
      onSubmit={async (v) => {
        const c = await unwrap(api.POST('/commons/challenges', { body: {
          title: String(v.title).trim(), description: String(v.description).trim(),
          endsAt: String(v.endsAt), judging: v.judging as 'likes' | 'owner',
        } }));
        await qc.invalidateQueries({ queryKey: ['commons', 'challenges'] });
        toast('Challenge created');
        onCreated(c.id);
      }} />
  );
}
