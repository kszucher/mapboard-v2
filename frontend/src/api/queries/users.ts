import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import { queryKeys } from '../queryKeys';

export const useUserId = () => {
  return useQuery({
    queryKey: queryKeys.users.current(),
    queryFn: async () => {
      const res = await apiClient.POST('/users/get-or-create', {});
      if ('error' in res) throw res.error;
      return res.data ?? null;
    },
    staleTime: Infinity, // User ID doesn't change during session
    gcTime: Infinity,
  });
};

export const useActiveGraphId = (userId: string | null) => {
  return useQuery({
    queryKey: queryKeys.users.activeGraph(userId),
    queryFn: async () => {
      const res = await apiClient.GET('/users/{user_id}/active-graph', {
        params: { path: { user_id: userId ?? '' } },
      });
      if ('error' in res) throw res.error;
      return (res as { data: { graph_id?: string | null } }).data?.graph_id ?? null;
    },
    enabled: Boolean(userId),
  });
};
