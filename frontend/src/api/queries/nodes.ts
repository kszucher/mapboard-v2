import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { components } from '../generated/schema';
import { queryKeys } from '../queryKeys';

type NodeRead = components['schemas']['NodeRead'];

const fetchNodes = async (graphId: string): Promise<NodeRead[]> => {
  const res = await apiClient.GET('/nodes/graph/{graph_id}', { 
    params: { path: { graph_id: graphId } } 
  });
  if ('error' in res) throw res.error;
  return res.data ?? [];
};

export const useNodes = (graphId: string) => {
  return useQuery({
    queryKey: queryKeys.nodes.byGraph(graphId),
    queryFn: () => fetchNodes(graphId),
    enabled: Boolean(graphId),
  });
};
