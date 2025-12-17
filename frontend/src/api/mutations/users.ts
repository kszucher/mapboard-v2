import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import { queryKeys } from '../queryKeys';

export const useSetActiveGraph = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, graphId }: { userId: string; graphId: string }) => {
      const res = await apiClient.POST('/users/set-active-graph', {
        body: { user_id: userId, graph_id: graphId },
      });
      if ('error' in res) throw res.error;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.activeGraph(variables.userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nodes.byGraph(variables.graphId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.edges.byGraph(variables.graphId) });
    },
  });
};
