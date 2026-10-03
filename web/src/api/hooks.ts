/*
 * Conventions for area agents
 * - One hook file per area: routes/<area>/queries.ts. Shared hooks (useMe, usePoll) live here.
 * - Query keys are `[module, ...params]`, e.g. ['classes', id, 'posts'], ['me', 'today'].
 * - Queries: `queryFn: () => unwrap(api.GET('/path', { params }))`. Errors arrive as {code, message}.
 * - Mutations: onSuccess invalidates the related keys (prefix match: ['classes', id]) and
 *   toast()s the PROTO success copy (ui/Toast), e.g.
 *     useMutation({ mutationFn: (body) => unwrap(api.POST('/posts', { body })),
 *       onSuccess: () => { qc.invalidateQueries({ queryKey: ['posts'] }); toast('Posted.'); } })
 * - Don't handle 401/403 yourself: the client sends 401 to /login and toasts a 403's message.
 *   Show other errors inline (error.message) where the form/list is.
 * - Polling (check-in list, messages): keep the normal useQuery and add usePoll(sameKey, ms).
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { api } from './client';
import type { components } from './schema';

export type Me = components['schemas']['Me'];

// No session (401, API down, offline) resolves to null, never throws: the route guard redirects on it.
export const meQuery = {
  queryKey: ['me'],
  queryFn: async (): Promise<Me | null> => (await api.GET('/auth/me')).data ?? null,
};
export const useMe = () => useQuery(meQuery);

// Refetch the queries under `key` every `ms` while mounted and the tab is visible.
export function usePoll(key: QueryKey, ms: number) {
  const qc = useQueryClient();
  const k = JSON.stringify(key);
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) qc.invalidateQueries({ queryKey: JSON.parse(k) as QueryKey });
    }, ms);
    return () => clearInterval(t);
  }, [qc, k, ms]);
}
