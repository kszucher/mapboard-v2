import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient, getClientId } from '../client'
import type { components } from '../generated/schema'
import { queryKeys } from '../queryKeys'

type NodeRead = components['schemas']['NodeRead'];
type NodeType = NodeRead['node_type'];
type NodeColor = components['schemas']['NodeCreate']['color'];


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


// Hook for updating node dimensions
export const useUpdateNodeDimensions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nodeId, width, height }: { nodeId: string; width: number; height: number; graphId: string }) => {
      const res = await apiClient.PATCH('/nodes/{node_id}/dimensions', {
        params: { path: { node_id: nodeId } },
        headers: { 'X-Client-Id': getClientId() },
        body: { width, height },
      });
      if ('error' in res) throw res.error;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.nodes.byGraph(variables.graphId) });
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

// Hook for updating node offset (position)
export const useUpdateNodePosition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nodeId, x, y }: { nodeId: string; x: number; y: number; graphId?: string }) => {
      const res = await apiClient.PATCH('/nodes/{node_id}/offset', {
        params: { path: { node_id: nodeId } },
        headers: { 'X-Client-Id': getClientId() },
        body: {
          offset_x: Math.round(x),
          offset_y: Math.round(y),
        },
      });
      if ('error' in res) throw res.error;
    },
    onMutate: async ({ nodeId, x, y, graphId }) => {
      if (!graphId) return;

      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: queryKeys.nodes.byGraph(graphId) });

      // Snapshot the previous value
      const previousNodes = queryClient.getQueryData<NodeRead[]>(queryKeys.nodes.byGraph(graphId));

      // Optimistically update to the new value
      if (previousNodes) {
        queryClient.setQueryData<NodeRead[]>(
          queryKeys.nodes.byGraph(graphId),
          previousNodes.map(node =>
            node.id === nodeId
              ? { ...node, offset_x: Math.round(x), offset_y: Math.round(y) }
              : node
          )
        );
      }

      // Return a context object with the snapshotted value
      return { previousNodes, graphId };
    },
    onError: (_err, _variables, context) => {
      // Rollback to the previous value if mutation fails
      if (context?.previousNodes && context.graphId) {
        queryClient.setQueryData(
          queryKeys.nodes.byGraph(context.graphId),
          context.previousNodes
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch after error or success to make sure we're in sync with the server
      if (variables.graphId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.nodes.byGraph(variables.graphId) });
      }
    },
  });
};

