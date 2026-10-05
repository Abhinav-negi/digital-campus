import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../api/client';
import type { components } from '../../api/schema';

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
