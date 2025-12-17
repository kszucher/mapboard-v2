import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { components } from '../api/generated/schema';

type NodeRead = components['schemas']['NodeRead'];
type EdgeRead = components['schemas']['EdgeRead'];

const fetchNodes = async (graphId: string): Promise<NodeRead[]> => {
  const res = await apiClient.GET('/nodes/graph/{graph_id}', { params: { path: { graph_id: graphId } } });
  if (res.error) throw res.error;
  return res.data ?? [];
};

const fetchEdges = async (graphId: string): Promise<EdgeRead[]> => {
  const res = await apiClient.GET('/edges/graph/{graph_id}', { params: { path: { graph_id: graphId } } });
  if (res.error) throw res.error;
  return res.data ?? [];
};

export const useGraphQueries = (graphId: string) => {
  const nodes = useQuery({
    queryKey: ['nodes', graphId],
    queryFn: () => fetchNodes(graphId),
    enabled: Boolean(graphId),
  });
  const edges = useQuery({
    queryKey: ['edges', graphId],
    queryFn: () => fetchEdges(graphId),
    enabled: Boolean(graphId),
  });

  return {
    nodes: nodes.data,
    edges: edges.data,
  };
};

export const useActiveGraphId = (userId: string | null) => {
  return useQuery({
    queryKey: ['users', userId, 'active-graph'],
    queryFn: async () => {
      const res = await apiClient.GET('/users/{user_id}/active-graph', {
        params: { path: { user_id: userId ?? '' } },
      });
      if (res.error) throw res.error;
      return res.data?.graph_id ?? null;
    },
    enabled: Boolean(userId),
  });
};

export const useUserGraphs = (userId: string | null) => {
  return useQuery({
    queryKey: ['graphs', userId],
    queryFn: async () => {
      const res = await apiClient.GET('/graphs/user/{user_id}', {
        params: { path: { user_id: userId ?? '' } },
      });
      if (res.error) throw res.error;
      return res.data ?? [];
    },
    enabled: Boolean(userId),
  });
};