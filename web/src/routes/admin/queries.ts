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
