import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getClientId } from '../client';
import { queryKeys } from '../queryKeys';

export const useCreateEdge = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      graphId,
      fromNodeId,
      toNodeId,
      handleIndex,
      fromExpressionId,
      edgeId,
    }: {
      graphId: string;
      fromNodeId: string;
      toNodeId: string;
      handleIndex: number;
      fromExpressionId?: string;
      edgeId?: string;
    }) => {
      const res = await apiClient.POST('/edges/', {
        headers: { 'X-Client-Id': getClientId() },
        body: {
          id: edgeId,
          graph_id: graphId,
          from_node_id: fromNodeId,
          to_node_id: toNodeId,
          handle_index: handleIndex,
          from_expression_id: fromExpressionId,
        },
      });
      if ('error' in res) throw res.error;
      return res.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.graphs.flow(variables.graphId) });
    },
  });
};

export const useDeleteEdge = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ edgeId }: { edgeId: string }) => {
      const res = await apiClient.DELETE('/edges/{edge_id}', {
        params: { path: { edge_id: edgeId } },
        headers: { 'X-Client-Id': getClientId() },
      });
      if ('error' in res) throw res.error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.graphs.all });
    },
  });
};


