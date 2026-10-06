import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../../../api/client';
import { FormSheet, type Field } from '../../../../ui/FormSheet';
import { Icon } from '../../../../ui/Icon';
import { toast } from '../../../../ui/Toast';

type BoardBody = { kind: AddKind; title: string; body?: string; subjectId?: string; date?: string; pinned?: boolean; fileKey?: string; fileName?: string };
export type AddKind = 'notice' | 'exam' | 'deadline' | 'file';

const TITLES: Record<AddKind, string> = { notice: 'Add a notice', exam: 'Add an exam', deadline: 'Add a deadline', file: 'Add a file' };

/** Refresh everything a board edit can change. */
function useRefresh(classId: string) {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: ['classes', classId, 'board'] }),
    qc.invalidateQueries({ queryKey: ['classes', classId, 'history'] }),
    qc.invalidateQueries({ queryKey: ['me', 'today'] }),
  ]);
}

function useSubjects(classId: string) {
  const q = useQuery({ queryKey: ['classes', classId, 'subjects'], queryFn: () => unwrap(api.GET('/classes/{id}/subjects', { params: { path: { id: classId } } })) });
  return [['', 'No subject'] as const, ...(q.data?.items ?? []).map((s) => [s.id, s.name] as const)];
}

/** PROTO addBoard (student.html:520): notice / exam / deadline / file form. */
export function AddBoardSheet({ classId, kind, onClose }: { classId: string; kind: AddKind; onClose: () => void }) {
  const subjects = useSubjects(classId);
  const refresh = useRefresh(classId);
  const add = useMutation({ mutationFn: (body: BoardBody) => unwrap(api.POST('/classes/{id}/board', { params: { path: { id: classId } }, body })) });
  const subj: Field = { name: 'subjectId', label: 'Subject', type: 'select', options: subjects };
  const fields: Record<AddKind, Field[]> = {
    exam: [{ name: 'title', label: 'Exam name', req: true }, subj, { name: 'date', label: 'Date', type: 'date', req: true }, { name: 'body', label: 'Note (optional)', type: 'textarea' }],
    deadline: [{ name: 'title', label: 'Title', req: true }, subj, { name: 'date', label: 'Due date', type: 'date', req: true }],
    notice: [{ name: 'title', label: 'Title', req: true }, { name: 'body', label: 'Text', type: 'textarea' }, { name: 'pinned', label: 'Pin to the top', type: 'checkbox' }],
    file: [{ name: 'title', label: 'Title', req: true }, { name: 'file', label: 'File', type: 'file', req: true }],
  };
  return <FormSheet title={TITLES[kind]} fields={fields[kind]} label="Save" onClose={onClose}
    onSubmit={async (v) => {
      const s = (k: string) => String(v[k] ?? '').trim();
      const file = v.file && typeof v.file === 'object' ? v.file : null;
      await add.mutateAsync({
        kind, title: s('title'), body: s('body') || undefined, subjectId: s('subjectId') || undefined, date: s('date') || undefined,
        pinned: kind === 'notice' ? v.pinned === true : undefined, fileKey: file?.key, fileName: file?.name,
      });
      await refresh();
      toast(`${kind[0]!.toUpperCase()}${kind.slice(1)} added`);
    }} />;
}

/** The small "x" next to a board item. Returns a render fn so Board can drop it into any row. */
export function useRemoveItem(classId: string) {
  const refresh = useRefresh(classId);
  const del = useMutation({
    mutationFn: (itemId: string) => unwrap(api.DELETE('/classes/{id}/board/{itemId}', { params: { path: { id: classId, itemId } } })),
    onSuccess: async () => { await refresh(); toast('Removed'); },
    onError: (e) => toast(e.message),
  });
  return (itemId: string) => (
    <button type="button" className="icon-btn" aria-label="Remove" disabled={del.isPending} onClick={() => del.mutate(itemId)}><Icon name="x" size={16} /></button>
  );
}

/** "+ Add" button for a section header. */
export const AddButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button type="button" className="btn sm" onClick={onClick}><Icon name="plus" size={16} /> {label}</button>
);

/** PROTO toBoard (student.html:558): a teacher post becomes an exam or deadline. ST-06's post sheet renders this. */
export function AddToBoardSheet({ classId, post, onClose }: {
  classId: string; post: { id: string; title: string; kind?: string; dueAt?: string | null }; onClose: () => void;
}) {
  const subjects = useSubjects(classId);
  const refresh = useRefresh(classId);
  const add = useMutation({
    mutationFn: (body: { postId: string; kind: 'exam' | 'deadline'; title: string; date: string; subjectId?: string }) =>
      unwrap(api.POST('/classes/{id}/board/from-post', { params: { path: { id: classId } }, body })),
  });
  return <FormSheet title="Add to board" label="Add to board" onClose={onClose}
    fields={[
      { name: 'kind', label: 'As', type: 'select', value: post.kind === 'assignment' ? 'deadline' : 'exam', options: [['exam', 'Exam'], ['deadline', 'Deadline']] },
      { name: 'title', label: 'Title', value: post.title, req: true },
      { name: 'subjectId', label: 'Subject', type: 'select', options: subjects },
      { name: 'date', label: 'Date', type: 'date', value: post.dueAt?.slice(0, 10) ?? '', req: true },
    ]}
    onSubmit={async (v) => {
      await add.mutateAsync({ postId: post.id, kind: v.kind as 'exam', title: String(v.title).trim(), date: String(v.date), subjectId: String(v.subjectId) || undefined });
      await refresh();
      toast('Added to the board');
    }} />;
}
