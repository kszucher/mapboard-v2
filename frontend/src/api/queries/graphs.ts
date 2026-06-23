import { queryOptions, useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import { queryKeys } from '../queryKeys';

export const graphQueries = {
  byUser: (userId: string | null) => queryOptions({
    queryKey: queryKeys.graphs.byUser(userId),
    queryFn: async () => {
      const res = await apiClient.GET('/graphs/user/{user_id}', {
        params: { path: { user_id: userId ?? '' } },
      });
      if ('error' in res) throw res.error;
      return res.data ?? [];
    },
    enabled: Boolean(userId),
  }),
};

export const useUserGraphs = (userId: string | null) => {
  return useQuery(graphQueries.byUser(userId));
};
