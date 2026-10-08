import { useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../../../api/client';
import { FormSheet } from '../../../../ui/FormSheet';
import { toast } from '../../../../ui/Toast';
import { STATUS } from './Projects';

export function NewProject({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  return (
    <FormSheet title="New project" label="Create project" onClose={onClose}
      fields={[
        { name: 'title', label: 'Title', req: true },
        { name: 'description', label: 'What is it?', type: 'textarea', req: true },
        { name: 'roles', label: 'Roles needed (comma separated)', ph: 'Frontend, Design' },
        { name: 'repoUrl', label: 'Repository link (optional)', type: 'url', ph: 'https://github.com/…' },
        { name: 'status', label: 'Status', type: 'select', options: Object.entries(STATUS) },
      ]}
      onSubmit={async (v) => {
        const repoUrl = String(v.repoUrl).trim();
        const p = await unwrap(api.POST('/commons/projects', { body: {
          title: String(v.title).trim(), description: String(v.description).trim(),
          roles: String(v.roles).split(',').map((x) => x.trim()).filter(Boolean),
          ...(repoUrl && { repoUrl }), status: v.status as keyof typeof STATUS,
        } }));
        await qc.invalidateQueries({ queryKey: ['commons', 'projects'] });
        toast('Project created');
        onCreated(p.id);
      }} />
  );
}
