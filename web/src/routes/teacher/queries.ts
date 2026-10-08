import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../api/client';
import type { components } from '../../api/schema';
import { upload } from '../../ui/FormSheet';

export type StaffToday = components['schemas']['StaffToday'];
export type TodaySession = components['schemas']['TodaySession'];

// GET /me/today returns StudentToday | StaffToday; a teacher always gets the staff shape.
export const useStaffToday = () => useQuery({
  queryKey: ['me', 'today'],
  queryFn: async () => (await unwrap(api.GET('/me/today'))) as StaffToday,
});

// POST /classes/:id/changes replaces any earlier cancel/move of the slot on that date.
export function useSessionChange(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { date: string; kind: 'cancelled' | 'moved'; slotId: string; start?: string; end?: string; room?: string; movedToDate?: string; note?: string }) =>
      unwrap(api.POST('/classes/{id}/changes', { params: { path: { id: classId } }, body })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['me', 'today'] }); qc.invalidateQueries({ queryKey: ['classes', classId] }); },
  });
}

// POST /attendance-sessions is idempotent: opens or fetches the session for subject/date/slot.
export const openAttendance = (b: { subjectId: string; date: string; slotId?: string }) =>
  unwrap(api.POST('/attendance-sessions', { body: b }));

// Subjects the signed-in teacher teaches, across their classes, for the past-session picker.
export const useMySubjects = (userId: string) => useQuery({
  queryKey: ['classes', 'mySubjects', userId],
  queryFn: async () => {
    const { items } = await unwrap(api.GET('/classes'));
    const per = await Promise.all(items.filter((c) => !c.archivedAt).map(async (c) =>
      (await unwrap(api.GET('/classes/{id}/subjects', { params: { path: { id: c.id } } }))).items
        .filter((s) => s.teacher?.id === userId).map((s) => ({ id: s.id, name: s.name, className: c.name }))));
    return per.flat();
  },
});

// Unread "you were added as a subject teacher" notifications (CS-12), for the Today allotment cards.
export const useAllotments = () => useQuery({
  queryKey: ['me', 'notifications', 'allotted'],
  queryFn: async () => (await unwrap(api.GET('/me/notifications', { params: { query: { limit: 50 } } }))).items
    .filter((n) => n.type === 'subject-allotted' && !n.read),
});

// "Got it" marks the notification read; "Not me" (CS-03) unassigns me first, then marks it read.
export function useAllotmentReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decline }: { id: string; decline?: { classId: string; subjectId: string } }) => {
      if (decline) await unwrap(api.POST('/classes/{id}/subjects/{sid}/decline', { params: { path: { id: decline.classId, sid: decline.subjectId } } }));
      await unwrap(api.POST('/me/notifications/read', { body: { ids: [id] } }));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['me'] }); qc.invalidateQueries({ queryKey: ['classes'] }); },
  });
}

// TE-07 new class wizard. GET /branches; POST /classes; POST /classes/:id/invites with dryRun for the preview.
export const useBranches = () => useQuery({ queryKey: ['branches'], queryFn: async () => (await unwrap(api.GET('/branches'))).items });
export const useCreateClass = () => useMutation({
  mutationFn: (body: { branchId: string; admissionYear: number; section: string; minAttendancePct: number }) => unwrap(api.POST('/classes', { body })),
});
export const useInvitePreview = () => useMutation({
  mutationFn: ({ id, rows }: { id: string; rows: { studentIdNo: string; email: string }[] }) =>
    unwrap(api.POST('/classes/{id}/invites', { params: { path: { id } }, body: { rows, dryRun: true } })),
});

// TE-08 composer + Upcoming. POST /posts fans out to every target class; presign → PUT is the attachment flow.
export const useTeachingClasses = () => useQuery({
  queryKey: ['classes'],
  queryFn: () => unwrap(api.GET('/classes')),
  select: (d) => d.items.filter((c) => !c.archivedAt && c.myRole !== 'student' && c.myRole !== 'cr' && c.myRole !== null),
});

export async function uploadAttachment(f: File) {
  const { key, name } = await upload(f);
  return { fileKey: key, fileName: name };
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { kind: 'announcement' | 'assignment'; title: string; body: string; classIds: string[]; dueAt?: string; file?: File | null }) =>
      (async () => {
        const { file, ...rest } = b;
        return unwrap(api.POST('/posts', { body: { ...rest, ...(file && (await uploadAttachment(file))) } }));
      })(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['posts'] }); qc.invalidateQueries({ queryKey: ['classes'] }); qc.invalidateQueries({ queryKey: ['me'] }); },
  });
}

export const useUpcoming = () => useQuery({
  queryKey: ['me', 'upcoming', 30],
  queryFn: async () => (await unwrap(api.GET('/me/upcoming', { params: { query: { days: 30 } } }))).items,
});

export const useAddReminder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; date: string }) => unwrap(api.POST('/me/reminders', { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
};
