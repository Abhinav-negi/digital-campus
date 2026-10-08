import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
