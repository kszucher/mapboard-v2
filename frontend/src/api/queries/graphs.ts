import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../client'
import type { components } from '../generated/schema'
import { queryKeys } from '../queryKeys'

type GraphRead = components['schemas']['GraphRead'];

export const useUserGraphs = (userId: string | null) => {
  return useQuery<GraphRead[]>({
    queryKey: queryKeys.graphs.byUser(userId),
    queryFn: async () => {
      const res = await apiClient.GET('/graphs/user/{user_id}', {
        params: { path: { user_id: userId ?? '' } },
      });
      if ('error' in res) throw res.error;
      return res.data ?? [];
    },
    enabled: Boolean(userId),
  });
};
