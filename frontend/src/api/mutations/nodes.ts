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
    onMutate: async ({ nodeId, width, height, graphId }: { nodeId: string; width: number; height: number; graphId: string }) => {
      const queryKey = queryKeys.nodes.byGraph(graphId);
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<NodeRead[]>(queryKey);

      if (previous && nodeId) {
        queryClient.setQueryData<NodeRead[]>(queryKey, old => {
          if (!old) return old;
          return old.map(n => (n.id === nodeId ? ({ ...n, width, height } as NodeRead) : n));
        });
      }

      return { previous, graphId };
    },
    mutationFn: async ({ nodeId, width, height }: { nodeId: string; width: number; height: number; graphId: string }) => {
      const res = await apiClient.PATCH('/nodes/{node_id}/dimensions', {
        params: { path: { node_id: nodeId } },
        headers: { 'X-Client-Id': getClientId() },
        body: { width, height },
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

// Hook for updating node offset (position)
export const useUpdateNodePosition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    onMutate: async ({ nodeId, x, y, graphId }: { nodeId: string; x: number; y: number; graphId?: string }) => {
      if (!graphId) return;

      const offset_x = Math.round(x);
      const offset_y = Math.round(y);

      const queryKey = queryKeys.nodes.byGraph(graphId);
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<NodeRead[]>(queryKey);

      if (previous && nodeId) {
        queryClient.setQueryData<NodeRead[]>(queryKey, old => {
          if (!old) return old;
          return old.map(n => (n.id === nodeId ? ({ ...n, offset_x, offset_y } as NodeRead) : n));
        });
      }

      return { previous, graphId };
    },
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
    onError: (_err, _variables, context) => {
      if (context?.graphId) {
        queryClient.setQueryData(queryKeys.nodes.byGraph(context.graphId), context.previous);
      }
    },
  });
};

export const useUpdateNodeLabel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    onMutate: async ({ nodeId, label, graphId }: { nodeId: string; label: string; graphId: string }) => {
      const queryKey = queryKeys.nodes.byGraph(graphId);
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<NodeRead[]>(queryKey);

      if (previous && nodeId) {
        queryClient.setQueryData<NodeRead[]>(queryKey, old => {
          if (!old) return old;
          return old.map(n => (n.id === nodeId ? ({ ...n, label } as NodeRead) : n));
        });
      }

      return { previous, graphId };
    },
    mutationFn: async ({ nodeId, label }: { nodeId: string; label: string; graphId: string }) => {
      const res = await apiClient.PATCH('/nodes/{node_id}/label', {
        params: { path: { node_id: nodeId } },
        headers: { 'X-Client-Id': getClientId() },
        body: { label },
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

export const useUpdateNodeColor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    onMutate: async ({ nodeId, color, graphId }: { nodeId: string; color: NodeColor; graphId: string }) => {
      const queryKey = queryKeys.nodes.byGraph(graphId);
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<NodeRead[]>(queryKey);

      if (previous && nodeId) {
        queryClient.setQueryData<NodeRead[]>(queryKey, old => {
          if (!old) return old;
          return old.map(n => (n.id === nodeId ? ({ ...n, color } as NodeRead) : n));
        });
      }

      return { previous, graphId };
    },
    mutationFn: async ({ nodeId, color }: { nodeId: string; color: NodeColor; graphId: string }) => {
      const res = await apiClient.PATCH('/nodes/{node_id}/color', {
        params: { path: { node_id: nodeId } },
        headers: { 'X-Client-Id': getClientId() },
        body: { color },
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
