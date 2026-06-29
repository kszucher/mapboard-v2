import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getClientId } from '../client';
import type { components } from '../generated/schema';
import { queryKeys } from '../queryKeys';

type NodeType = components['schemas']['NodeRead']['node_type'];
type NodeColor = components['schemas']['NodeCreate']['color'];

export type InsertableNodeType = Exclude<NodeType, 'START' | 'END'>;

const NODE_COLORS: Record<NodeType, NodeColor> = {
  START: 'gray',
  END: 'gray',
  LOGIC: 'purple',
  AGENT: 'blue',
  LOGICAL_SWITCH: 'amber',
  AGENTIC_SWITCH: 'grass',
  LOGICAL_JOIN: 'teal',
  AGENTIC_JOIN: 'indigo',
};

const NODE_LABELS: Record<NodeType, string> = {
  START: 'Start',
  END: 'End',
  LOGIC: 'Logic',
  AGENT: 'Agent',
  LOGICAL_SWITCH: 'Logical Switch',
  AGENTIC_SWITCH: 'Agentic Switch',
  LOGICAL_JOIN: 'Logical Join',
  AGENTIC_JOIN: 'Agentic Join',
};

export const useCreateNode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ graphId, nodeType, nodeId }: { graphId: string; nodeType: NodeType; nodeId?: string }) => {
      const res = await apiClient.POST('/nodes/', {
        headers: { 'X-Client-Id': getClientId() },
        body: {
          id: nodeId,
          graph_id: graphId,
          iid: 1,
          color: NODE_COLORS[nodeType],
          label: NODE_LABELS[nodeType],
          node_type: nodeType,
          is_processing: false,
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


export const useDeleteNode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nodeId }: { nodeId: string; graphId: string }) => {
      const res = await apiClient.DELETE('/nodes/{node_id}', {
        params: { path: { node_id: nodeId } },
        headers: { 'X-Client-Id': getClientId() },
      });
      if ('error' in res) throw res.error;
      return res.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.graphs.flow(variables.graphId) });
    },
  });
};

export const useShortcircuitNode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nodeId }: { nodeId: string; graphId: string }) => {
      const res = await apiClient.POST('/nodes/{node_id}/shortcircuit', {
        params: { path: { node_id: nodeId } },
        headers: { 'X-Client-Id': getClientId() },
      });
      if ('error' in res) throw res.error;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.graphs.flow(variables.graphId) });
    },
  });
};

export const useAddConnectedNode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: {
      expressionId: string;
      nodeType: InsertableNodeType;
      graphId: string;
      nodeId?: string;
      baseExpressionId?: string;
      subExpressionId?: string;
      edgeId?: string;
    }) => {
      const nodeId = variables.nodeId || crypto.randomUUID();
      const baseExpressionId = variables.baseExpressionId || crypto.randomUUID();
      const edgeId = variables.edgeId || crypto.randomUUID();
      const subExpressionId = variables.subExpressionId || (['LOGICAL_SWITCH', 'AGENTIC_SWITCH', 'LOGICAL_JOIN', 'AGENTIC_JOIN'].includes(variables.nodeType) ? crypto.randomUUID() : null);

      const res = await apiClient.POST('/nodes/from-expression/{expression_id}', {
        params: {
          path: { expression_id: variables.expressionId },
        },
        body: {
          node_type: variables.nodeType,
          node_id: nodeId,
          base_expression_id: baseExpressionId,
          sub_expression_id: subExpressionId,
          edge_id: edgeId,
        },
        headers: { 'X-Client-Id': getClientId() },
      });
      if ('error' in res) throw res.error;
      return res.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.graphs.flow(variables.graphId) });
    },
  });
};

export const useInsertNode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: {
      expressionId: string;
      nodeType: InsertableNodeType;
      graphId: string;
    }) => {
      const res = await apiClient.POST('/nodes/insert-between/{expression_id}', {
        params: {
          path: { expression_id: variables.expressionId },
          query: { node_type: variables.nodeType },
        },
        headers: { 'X-Client-Id': getClientId() },
      });
      if ('error' in res) throw res.error;
      return res.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.graphs.flow(variables.graphId) });
    },
  });
};
