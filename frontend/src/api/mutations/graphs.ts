import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getClientId } from '../client';
import type { components } from '../generated/schema';
import { queryKeys } from '../queryKeys';

type GraphSyncPayload = components['schemas']['GraphSyncPayload'];

export const useCreateGraph = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, graphName }: { userId: string; graphName: string }) => {
      const res = await apiClient.POST('/graphs/', {
        headers: { 'X-Client-Id': getClientId() },
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

export const useSyncGraphFlow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ graphId, payload }: { graphId: string; payload: GraphSyncPayload }) => {
      const res = await apiClient.PUT('/graphs/{graph_id}/sync', {
        params: { path: { graph_id: graphId } },
        headers: { 'X-Client-Id': getClientId() },
        body: payload,
      });
      if ('error' in res) throw res.error;
      return res.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.graphs.flow(variables.graphId) });
    },
  });
};
