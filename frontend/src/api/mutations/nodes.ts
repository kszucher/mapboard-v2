import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getClientId } from '../client';
import type { components } from '../generated/schema';
import { queryKeys } from '../queryKeys';

type NodeType = components['schemas']['NodeRead']['node_type'];
type NodeColor = components['schemas']['NodeCreate']['color'];
type NodeRead = components['schemas']['NodeRead'];

const NODE_COLORS: Record<NodeType, NodeColor> = {
  START: 'gray',
  LOGIC: 'purple',
  AGENT: 'blue',
  LOGICAL_SWITCH: 'amber',
  AGENTIC_SWITCH: 'grass',
};

const NODE_LABELS: Record<NodeType, string> = {
  START: 'Start',
  LOGIC: 'Logic',
  AGENT: 'Agent',
  LOGICAL_SWITCH: 'Logical Switch',
  AGENTIC_SWITCH: 'Agentic Switch',
};

export const useCreateNode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ graphId, nodeType }: { graphId: string; nodeType: NodeType }) => {
      const defaultExpressions =
        nodeType === 'START'
          ? []
          : [
            {
              idx: 0,
              raw_string: '',
            },
          ];

      const res = await apiClient.POST('/nodes/', {
        headers: { 'X-Client-Id': getClientId() },
        body: {
          graph_id: graphId,
          iid: 1,
          width: 200,
          height: 120,
          offset_x: 0,
          offset_y: 50,
          color: NODE_COLORS[nodeType],
          label: NODE_LABELS[nodeType],
          node_type: nodeType,
          is_processing: false,
          expressions: defaultExpressions,
        },
      });
      if ('error' in res) throw res.error;
      return res.data as string;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.nodes.byGraph(variables.graphId) });
    },
  });
};

export const useUpdateNode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    onMutate: async ({ nodeId, patch }) => {
      const graphId = patch.graph_id as string | undefined;
      if (!graphId) return;

      const patchWithDerived = { ...patch } as Record<string, unknown>;

      const queryKey = queryKeys.nodes.byGraph(graphId);
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<NodeRead[]>(queryKey);

      if (previous && nodeId) {
        queryClient.setQueryData<NodeRead[]>(queryKey, old => {
          if (!old) return old;
          return old.map(n => (n.id === nodeId ? ({ ...n, ...patchWithDerived } as NodeRead) : n));
        });
      }

      return { previous, graphId };
    },
    mutationFn: async ({ nodeId, patch }: { nodeId: string; patch: Record<string, unknown> }) => {
      const res = await apiClient.PATCH('/nodes/{node_id}', {
        params: { path: { node_id: nodeId } },
        headers: { 'X-Client-Id': getClientId() },
        body: patch,
      });
      if ('error' in res) throw res.error;
    },
    onError: (_err, _variables, context) => {
      if (context?.graphId) {
        queryClient.setQueryData(queryKeys.nodes.byGraph(context.graphId), context.previous);
      }
    },
  });
};

export const useDeleteNode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nodeId }: { nodeId: string }) => {
      const res = await apiClient.DELETE('/nodes/{node_id}', {
        params: { path: { node_id: nodeId } },
        headers: { 'X-Client-Id': getClientId() },
      });
      if ('error' in res) throw res.error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.nodes.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.edges.all });
    },
  });
};

// Convenience hook for updating node position
export const useUpdateNodePosition = () => {
  const updateNode = useUpdateNode();

  return {
    mutate: (nodeId: string, x: number, y: number, graphId?: string) => {
      updateNode.mutate({
        nodeId,
        patch: {
          graph_id: graphId,
          offset_x: Math.round(x),
          offset_y: Math.round(y),
        },
      });
    },
    mutateAsync: updateNode.mutateAsync,
    isPending: updateNode.isPending,
    isError: updateNode.isError,
    error: updateNode.error,
  };
};
