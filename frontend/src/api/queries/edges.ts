import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import { queryKeys } from '../queryKeys';
import type { components } from '../generated/schema';

type EdgeRead = components['schemas']['EdgeRead'];

const fetchEdges = async (graphId: string): Promise<EdgeRead[]> => {
  const res = await apiClient.GET('/edges/graph/{graph_id}', { 
    params: { path: { graph_id: graphId } } 
  });
  if ('error' in res) throw res.error;
  return res.data ?? [];
};

export const useEdges = (graphId: string) => {
  return useQuery({
    queryKey: queryKeys.edges.byGraph(graphId),
    queryFn: () => fetchEdges(graphId),
    enabled: Boolean(graphId),
  });
};
