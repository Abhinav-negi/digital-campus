import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../../api/client';
import type { components } from '../../api/schema';

export type StudentToday = components['schemas']['StudentToday'];

export const useToday = () => useQuery({
  queryKey: ['me', 'today'],
  queryFn: async () => (await unwrap(api.GET('/me/today'))) as StudentToday,
});

export const useCommonsCard = () => useQuery({
  queryKey: ['commons', 'card'],
  queryFn: () => unwrap(api.GET('/commons/card')),
});
