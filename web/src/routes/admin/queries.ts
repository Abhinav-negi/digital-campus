import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../api/client';
import type { components } from '../../api/schema';

export type InboxItem = components['schemas']['InboxItem'];
export type InboxType = 'tickets' | 'reports' | 'all';
export type InboxState = 'open' | 'answered' | 'closed' | 'hidden' | 'warned' | 'dismissed';

export const useOverview = () => useQuery({ queryKey: ['admin', 'overview'], queryFn: () => unwrap(api.GET('/admin/overview')) });

export const useInbox = (type: InboxType, state?: InboxState) => useQuery({
  queryKey: ['admin', 'inbox', type, state ?? null],
  queryFn: () => unwrap(api.GET('/admin/inbox', { params: { query: { type, state } } })),
});

const useRefresh = () => {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: ['admin'] }); qc.invalidateQueries({ queryKey: ['tickets'] }); };
};

// Admin reads a ticket thread with the shared GET /tickets/:id and replies with POST /tickets/:id/replies (→ answered).
export const useTicket = (id: string) => useQuery({ queryKey: ['tickets', id], queryFn: () => unwrap(api.GET('/tickets/{id}', { params: { path: { id } } })) });

export function useTicketReply(id: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: string) => unwrap(api.POST('/tickets/{id}/replies', { params: { path: { id } }, body: { body } })),
    onSuccess: refresh,
  });
}

export function useTicketState(id: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (state: 'open' | 'closed') => unwrap(api.PATCH('/admin/tickets/{id}', { params: { path: { id } }, body: { state } })),
    onSuccess: refresh,
  });
}

export function useReportAction() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'hide' | 'warn' | 'dismiss' | 'delete' }) =>
      unwrap(api.POST('/admin/reports/{id}', { params: { path: { id } }, body: { action } })),
    onSuccess: refresh,
  });
}

// AF-05 school + audit.
export type AuditFilters = { actorId?: string; classId?: string; action?: string; from?: string; to?: string };
export const useInstitution = () => useQuery({ queryKey: ['admin', 'institution'], queryFn: () => unwrap(api.GET('/admin/institution')) });
export function useInstitutionPatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; timezone?: string }) => unwrap(api.PATCH('/admin/institution', { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}
export const useAdminBranches = () => useQuery({ queryKey: ['admin', 'branches'], queryFn: async () => (await unwrap(api.GET('/admin/branches'))).items });
export function useBranchMutations() {
  const qc = useQueryClient();
  const done = () => { qc.invalidateQueries({ queryKey: ['admin'] }); qc.invalidateQueries({ queryKey: ['branches'] }); };
  return {
    add: useMutation({ mutationFn: (body: { code: string; name: string }) => unwrap(api.POST('/admin/branches', { body })), onSuccess: done }),
    rename: useMutation({ mutationFn: ({ id, ...body }: { id: string; code?: string; name?: string }) => unwrap(api.PATCH('/admin/branches/{id}', { params: { path: { id } }, body })), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => unwrap(api.DELETE('/admin/branches/{id}', { params: { path: { id } } })), onSuccess: done }),
  };
}
export const useAudit = (f: AuditFilters) => useInfiniteQuery({
  queryKey: ['admin', 'audit', f],
  initialPageParam: undefined as string | undefined,
  queryFn: ({ pageParam }) => unwrap(api.GET('/admin/audit', { params: { query: { ...f, cursor: pageParam } } })),
  getNextPageParam: (p) => p.nextCursor ?? undefined,
});

// AF-02 people. AD-01 users/invites/account control, AD-02 admin badge, AD-03 student edit/move, AD-05 Commons ban.
export type AdminUser = components['schemas']['AdminUser'];
export type PeopleFilters = { q?: string; role?: 'student' | 'staff'; branchId?: string; status?: 'invited' | 'active' | 'disabled' };
export const useUsers = (f: PeopleFilters) => useInfiniteQuery({
  queryKey: ['admin', 'users', f],
  initialPageParam: undefined as string | undefined,
  queryFn: ({ pageParam }) => unwrap(api.GET('/admin/users', { params: { query: { ...f, cursor: pageParam, limit: 50 } } })),
  getNextPageParam: (p) => p.nextCursor ?? undefined,
});
// Move-to-batch picker: admin sees every class with ?all=1 (archived ones are rejected by the move, so they are filtered out).
export const useAllClasses = (enabled: boolean) => useQuery({
  queryKey: ['classes', 'all'], enabled,
  queryFn: async () => (await unwrap(api.GET('/classes', { params: { query: { all: '1', limit: 100 } } }))).items.filter((c) => !c.archivedAt),
});
export function usePeopleMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const p = (id: string) => ({ params: { path: { id } } });
  return {
    invite: useMutation({ mutationFn: (body: { name: string; email: string; dept: string }) => unwrap(api.POST('/admin/staff-invites', { body })), onSuccess: done }),
    status: useMutation({ mutationFn: ({ id, status }: { id: string; status: 'active' | 'disabled' }) => unwrap(api.PATCH('/admin/users/{id}/status', { ...p(id), body: { status } })), onSuccess: done }),
    reset: useMutation({ mutationFn: (id: string) => unwrap(api.POST('/admin/users/{id}/reset-password', p(id))) }),
    admin: useMutation({ mutationFn: ({ id, isAdmin }: { id: string; isAdmin: boolean }) => unwrap(api.PUT('/admin/users/{id}/admin', { ...p(id), body: { isAdmin } })), onSuccess: done }),
    edit: useMutation({ mutationFn: ({ id, ...body }: { id: string; name?: string; studentIdNo?: string; email?: string }) => unwrap(api.PATCH('/admin/students/{id}', { ...p(id), body })), onSuccess: done }),
    move: useMutation({ mutationFn: ({ id, classId }: { id: string; classId: string }) => unwrap(api.POST('/admin/students/{id}/move', { ...p(id), body: { classId } })), onSuccess: done }),
    ban: useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => unwrap(api.POST('/admin/users/{id}/ban', { ...p(id), body: { reason } })) }),
    unban: useMutation({ mutationFn: (id: string) => unwrap(api.DELETE('/admin/users/{id}/ban', p(id))) }),
    remove: useMutation({ mutationFn: (id: string) => unwrap(api.DELETE('/admin/users/{id}', p(id))), onSuccess: done }),
  };
}
