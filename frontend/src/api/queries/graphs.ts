import { queryOptions, useQuery } from '@tanstack/react-query';
import { getDynamicLayers } from '../../components/shared/edgeUtils';
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
  flow: (graphId: string | null) => queryOptions({
    queryKey: queryKeys.graphs.flow(graphId),
    queryFn: async () => {
      const res = await apiClient.GET('/graphs/{graph_id}/flow', {
        params: { path: { graph_id: graphId ?? '' } },
      });
      if ('error' in res) throw res.error;
      return res.data;
    },
    enabled: Boolean(graphId),
    select: (data) => {
      if (!data) return data;
      const nodes = data.nodes.map((n) => ({ ...n, layer: 0 }));
      const edges = data.edges.map((e) => ({ ...e, isBack: false }));
      getDynamicLayers(nodes, edges);
      return {
        ...data,
        nodes,
        edges,
      };
    },
  }),
};

export const useUserGraphs = (userId: string | null) => {
  return useQuery(graphQueries.byUser(userId));
};

export const useGraphFlow = (graphId: string | null) => {
  return useQuery(graphQueries.flow(graphId));
};
