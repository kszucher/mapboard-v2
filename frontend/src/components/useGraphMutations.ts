import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { components } from '../api/generated/schema';

type NodeType = components['schemas']['NodeRead']['node_type'];

const NODE_COLORS: Record<NodeType, string> = {
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

export const useGraphMutations = () => {
  const queryClient = useQueryClient();

  const createGraphMutation = useMutation({
    mutationFn: async ({ userId, graphName }: { userId: string; graphName: string }) => {
      const res = await apiClient.POST('/graphs', {
        body: { user_id: userId, graph_name: graphName },
      });
      if (res.error) throw res.error;
      return res.data as string;
    },
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['graphs', variables.userId] });
      void queryClient.invalidateQueries({ queryKey: ['users', variables.userId, 'active-graph'] });
    },
  });

  const setActiveGraphMutation = useMutation({
    mutationFn: async ({ userId, graphId }: { userId: string; graphId: string }) => {
      const res = await apiClient.POST('/users/set-active-graph', {
        body: { user_id: userId, graph_id: graphId },
      });
      if (res.error) throw res.error;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['users', variables.userId, 'active-graph'] });
      void queryClient.invalidateQueries({ queryKey: ['nodes', variables.graphId] });
      void queryClient.invalidateQueries({ queryKey: ['edges', variables.graphId] });
    },
  });

  const createNodeMutation = useMutation({
    mutationFn: async ({ graphId, nodeType }: { graphId: string; nodeType: NodeType }) => {
      const res = await apiClient.POST('/nodes', {
        body: {
          graph_id: graphId,
          iid: 1,
          width: 200,
          height: 120,
          offset_x: 0,
          offset_y: 50,
          color: NODE_COLORS[nodeType],
          label: NODE_LABELS[nodeType],
          num_handles: 1,
          node_type: nodeType,
          is_processing: false,
        },
      });
      if (res.error) throw res.error;
      return res.data as string;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['nodes', variables.graphId] });
    },
  });

  const updateNodeMutation = useMutation({
    mutationFn: async ({ nodeId, patch }: { nodeId: string; patch: Record<string, unknown> }) => {
      const res = await apiClient.PATCH('/nodes/{node_id}', {
        params: { path: { node_id: nodeId } },
        body: patch,
      });
      if (res.error) throw res.error;
    },
    onSuccess: (_data, variables) => {
      const graphId = variables.patch.graph_id as string | undefined;
      void queryClient.invalidateQueries({ queryKey: graphId ? ['nodes', graphId] : ['nodes'] });
    },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: async ({ nodeId }: { nodeId: string }) => {
      const res = await apiClient.DELETE('/nodes/{node_id}', {
        params: { path: { node_id: nodeId } },
      });
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['nodes'] });
      void queryClient.invalidateQueries({ queryKey: ['edges'] });
    },
  });

  const createEdgeMutation = useMutation({
    mutationFn: async ({
      graphId,
      fromNodeId,
      toNodeId,
      handleIndex,
    }: {
      graphId: string;
      fromNodeId: string;
      toNodeId: string;
      handleIndex: number;
    }) => {
      const res = await apiClient.POST('/edges', {
        body: {
          graph_id: graphId,
          from_node_id: fromNodeId,
          to_node_id: toNodeId,
          handle_index: handleIndex,
        },
      });
      if (res.error) throw res.error;
      return res.data as string;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['edges', variables.graphId] });
    },
  });

  const deleteEdgeMutation = useMutation({
    mutationFn: async ({ edgeId }: { edgeId: string }) => {
      const res = await apiClient.DELETE('/edges/{edge_id}', {
        params: { path: { edge_id: edgeId } },
      });
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['edges'] });
    },
  });

  const deleteEdgesByNodeAndHandlesMutation = useMutation({
    mutationFn: async ({ fromNodeId, deletedHandleIndex }: { fromNodeId: string; deletedHandleIndex: number }) => {
      const res = await apiClient.POST('/edges/delete-by-handle', {
        body: { from_node_id: fromNodeId, deleted_handle_index: deletedHandleIndex },
      });
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['edges'] });
    },
  });

  const createGraph = (userId: string, graphName: string) => {
    void createGraphMutation.mutate({ userId, graphName });
  };

  const createNode = (graphId: string, nodeType: NodeType) => {
    void createNodeMutation.mutate({ graphId, nodeType });
  };

  const updateNodePosition = (nodeId: string, x: number, y: number, graphId?: string) => {
    void updateNodeMutation.mutate({
      nodeId,
      patch: {
        graph_id: graphId,
        offset_x: Math.round(x),
        offset_y: Math.round(y),
      },
    });
  };

  const updateNode = (args: { nodeId: string; patch: Record<string, unknown> }) => {
    void updateNodeMutation.mutate(args);
  };

  const deleteNode = (nodeId: string) => {
    void deleteNodeMutation.mutate({ nodeId });
  };

  const createEdge = (graphId: string, fromNodeId: string, toNodeId: string, handleIndex: number) => {
    void createEdgeMutation.mutate({ graphId, fromNodeId, toNodeId, handleIndex });
  };

  const deleteEdge = (edgeId: string) => {
    void deleteEdgeMutation.mutate({ edgeId });
  };

  const deleteEdgesByNodeAndHandles = (fromNodeId: string, deletedHandleIndex: number) => {
    void deleteEdgesByNodeAndHandlesMutation.mutate({ fromNodeId, deletedHandleIndex });
  };

  const setActiveGraph = (userId: string, graphId: string) => {
    void setActiveGraphMutation.mutate({ userId, graphId });
  };

  return {
    createNode,
    updateNodePosition,
    updateNode,
    deleteNode,
    createEdge,
    deleteEdge,
    deleteEdgesByNodeAndHandles,
    createGraph,
    setActiveGraph,
  };
};
