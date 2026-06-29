import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getClientId } from '../client';
import type { components } from '../generated/schema';
import { queryKeys } from '../queryKeys';

type NodeRead = components['schemas']['NodeRead'];
type NodeType = NodeRead['node_type'];
type NodeColor = components['schemas']['NodeCreate']['color'];

type ExpressionRead = components['schemas']['ExpressionRead'];
type EdgeRead = components['schemas']['EdgeRead'];
type GraphFlowRead = components['schemas']['GraphFlowRead'];

export type InsertableNodeType = Exclude<NodeType, 'START' | 'END'>;

const NODE_COLORS: Record<NodeType, NodeColor> = {
  START: 'gray',
  END: 'gray',
  LOGIC: 'purple',
  AGENT: 'blue',
  LOGICAL_SWITCH: 'amber',
  AGENTIC_SWITCH: 'grass',
  JOIN: 'indigo',
};

const NODE_LABELS: Record<NodeType, string> = {
  START: 'Start',
  END: 'End',
  LOGIC: 'Logic',
  AGENT: 'Agent',
  LOGICAL_SWITCH: 'Logical Switch',
  AGENTIC_SWITCH: 'Agentic Switch',
  JOIN: 'Join',
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
      const res = await apiClient.POST('/nodes/from-expression/{expression_id}', {
        params: {
          path: { expression_id: variables.expressionId },
        },
        body: {
          node_type: variables.nodeType,
          node_id: variables.nodeId!,
          base_expression_id: variables.baseExpressionId!,
          sub_expression_id: variables.subExpressionId || null,
          edge_id: variables.edgeId!,
        },
        headers: { 'X-Client-Id': getClientId() },
      });
      if ('error' in res) throw res.error;
      return res.data;
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.graphs.flow(variables.graphId) });

      // Generate stable client-side IDs
      variables.nodeId = variables.nodeId || crypto.randomUUID();
      variables.baseExpressionId = variables.baseExpressionId || crypto.randomUUID();
      variables.edgeId = variables.edgeId || crypto.randomUUID();
      if (!variables.subExpressionId && ['LOGICAL_SWITCH', 'AGENTIC_SWITCH', 'JOIN'].includes(variables.nodeType)) {
        variables.subExpressionId = crypto.randomUUID();
      }

      const previousGraph = queryClient.getQueryData<GraphFlowRead>(
        queryKeys.graphs.flow(variables.graphId)
      );

      if (previousGraph) {
        const maxIid = previousGraph.nodes.reduce((max, n) => Math.max(max, n.iid), 0);
        const nextIid = maxIid + 1;

        const newNode: NodeRead = {
          id: variables.nodeId,
          graph_id: variables.graphId,
          iid: nextIid,
          color: NODE_COLORS[variables.nodeType],
          label: NODE_LABELS[variables.nodeType],
          node_type: variables.nodeType,
          is_processing: false,
        };

        const newExpressions: ExpressionRead[] = [
          {
            id: variables.baseExpressionId,
            node_id: variables.nodeId,
            idx: 0,
            type: 'BASE',
            raw_string: '',
          },
        ];

        if (variables.subExpressionId) {
          newExpressions.push({
            id: variables.subExpressionId,
            node_id: variables.nodeId,
            idx: 0,
            type: 'SUB',
            raw_string: '',
          });
        }

        const fromNodeId = previousGraph.expressions.find(e => e.id === variables.expressionId)?.node_id || '';
        const toExpressionId = variables.nodeType === 'JOIN' && variables.subExpressionId ? variables.subExpressionId : variables.baseExpressionId;

        const newEdge: EdgeRead = {
          id: variables.edgeId,
          graph_id: variables.graphId,
          from_node_id: fromNodeId,
          to_node_id: variables.nodeId,
          from_expression_id: variables.expressionId,
          to_expression_id: toExpressionId,
        };

        queryClient.setQueryData<GraphFlowRead>(
          queryKeys.graphs.flow(variables.graphId),
          {
            ...previousGraph,
            nodes: [...previousGraph.nodes, newNode],
            expressions: [...previousGraph.expressions, ...newExpressions],
            edges: [...previousGraph.edges, newEdge],
          }
        );
      }

      return { previousGraph };
    },
    onError: (_err, variables, context) => {
      if (context?.previousGraph) {
        queryClient.setQueryData<GraphFlowRead>(
          queryKeys.graphs.flow(variables.graphId),
          context.previousGraph
        );
      }
    },
    onSettled: (_data, _error, variables) => {
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
