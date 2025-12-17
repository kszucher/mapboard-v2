import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import { queryKeys } from '../queryKeys';

export const useCreateGraph = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, graphName }: { userId: string; graphName: string }) => {
      const res = await apiClient.POST('/graphs/', {
        body: { user_id: userId, graph_name: graphName },
      });
      if ('error' in res) throw res.error;
      return res.data as string;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.graphs.byUser(variables.userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.activeGraph(variables.userId) });
    },
  });
};
