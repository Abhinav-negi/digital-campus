import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../api/client';
import { usePoll } from '../../api/hooks';
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

// POST /attendance-sessions is idempotent: opens or fetches the session; the page then loads it by id (GET) so reloads work.
export type AttendanceSession = components['schemas']['AttendanceSession'];
const sessionKey = (id: string) => ['attendance-session', id];
export const useAttendanceSession = (id: string) => useQuery({
  queryKey: sessionKey(id), retry: false, gcTime: 0, // gcTime 0: always fresh on open
  queryFn: () => unwrap(api.GET('/attendance-sessions/{id}', { params: { path: { id } } })),
});
export const openAttendance = async (b: { subjectId: string; date: string; slotId?: string }) => {
  return unwrap(api.POST('/attendance-sessions', { body: b }));
};

export function useSaveAttendance(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (absentIds: string[]) => unwrap(api.PUT('/attendance-sessions/{id}', { params: { path: { id } }, body: { absentIds } })),
    onSuccess: (s) => { qc.setQueryData(sessionKey(s.id), s); qc.invalidateQueries({ queryKey: ['me'] }); qc.invalidateQueries({ queryKey: ['classes'] }); },
  });
}

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

// TE-03 code mode. POST opens the 2-minute window (everyone absent-pending); GET (polled 2s) is the only source of the code.
export const useOpenCode = (id: string) => useMutation({
  mutationFn: () => unwrap(api.POST('/attendance-sessions/{id}/code', { params: { path: { id } } })),
});
export function useCode(id: string, on: boolean) {
  const key = ['attendance-code', id];
  usePoll(on ? key : ['attendance-code', 'off'], 2000);
  return useQuery({
    queryKey: key, enabled: on, retry: false,
    queryFn: () => unwrap(api.GET('/attendance-sessions/{id}/code', { params: { path: { id } } })),
  });
}

// TE-05a class view. GET /classes/:id/posts carries per-class seen stats for staff; Remind notifies the unseen students.
export const useClassPosts = (classId: string) => useQuery({
  queryKey: ['classes', classId, 'posts'],
  queryFn: async () => (await unwrap(api.GET('/classes/{id}/posts', { params: { path: { id: classId } } }))).items,
});
export const useRemind = () => useMutation({
  mutationFn: (postId: string) => unwrap(api.POST('/posts/{id}/remind', { params: { path: { id: postId } } })),
});

// TE-05b Students + Attendance tabs. Roster (CS-02) and per-subject standings (CS-09).
export const useRoster = (classId: string) => useQuery({
  queryKey: ['classes', classId, 'members'],
  queryFn: async () => (await unwrap(api.GET('/classes/{id}/members', { params: { path: { id: classId } } }))).items,
});
export function useRosterActions(classId: string) {
  const qc = useQueryClient();
  const done = () => { qc.invalidateQueries({ queryKey: ['classes', classId] }); qc.invalidateQueries({ queryKey: ['classes'] }); };
  const path = { id: classId };
  return {
    resend: useMutation({ mutationFn: (userId: string) => unwrap(api.POST('/classes/{id}/invites/resend', { params: { path }, body: { userId } })) }),
    setCr: useMutation({ mutationFn: (userIds: string[]) => unwrap(api.PUT('/classes/{id}/cr', { params: { path }, body: { userIds } })), onSuccess: done }),
    remove: useMutation({ mutationFn: (userId: string) => unwrap(api.DELETE('/classes/{id}/members/{userId}', { params: { path: { id: classId, userId } } })), onSuccess: done }),
    invite: useMutation({
      mutationFn: (rows: { studentIdNo: string; email: string }[]) => unwrap(api.POST('/classes/{id}/invites', { params: { path }, body: { rows, dryRun: false } })),
      onSuccess: done,
    }),
  };
}
// Subjects the viewer can see attendance for: all for the class teacher/admin, else the ones they teach.
export const useAttendanceSubjects = (classId: string, userId: string | undefined, all: boolean) => useQuery({
  queryKey: ['classes', classId, 'subjects', 'att', userId, all],
  queryFn: async () => (await unwrap(api.GET('/classes/{id}/subjects', { params: { path: { id: classId } } }))).items.filter((s) => all || s.teacher?.id === userId),
});
export const useClassAttendance = (classId: string, subjectId: string | undefined) => useQuery({
  queryKey: ['classes', classId, 'attendance', subjectId], enabled: !!subjectId,
  queryFn: () => unwrap(api.GET('/classes/{id}/attendance', { params: { path: { id: classId }, query: { subjectId: subjectId! } } })),
});

// TE-06 Settings tab (CS-01). Every write returns the fresh ClassCard; name/term changes show app-wide, so refetch all of ['classes'].
export function useClassSettings(classId: string) {
  const qc = useQueryClient();
  const params = { params: { path: { id: classId } } };
  const onSuccess = () => { qc.invalidateQueries({ queryKey: ['classes'] }); qc.invalidateQueries({ queryKey: ['me'] }); };
  return {
    setMin: useMutation({ mutationFn: (minAttendancePct: number) => unwrap(api.PATCH('/classes/{id}', { ...params, body: { minAttendancePct } })), onSuccess }),
    nextTerm: useMutation({ mutationFn: () => unwrap(api.POST('/classes/{id}/terms/next', params)), onSuccess }),
    graduate: useMutation({ mutationFn: () => unwrap(api.POST('/classes/{id}/graduate', params)), onSuccess }),
    handover: useMutation({ mutationFn: (teacherId: string) => unwrap(api.POST('/classes/{id}/handover', { ...params, body: { teacherId } })), onSuccess }),
  };
}
export const useStaffSearch = (q: string) => useQuery({
  queryKey: ['staff', q],
  queryFn: () => unwrap(api.GET('/staff', { params: { query: { q: q.trim() || undefined, limit: 8 } } })),
});
