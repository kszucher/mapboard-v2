import type { components } from '../api/generated/schema';
import type { ApiNode, AppFlowEdge, AppFlowNode } from '../components/types';
import type { GraphStoreState } from './types';

type ApiEdge = components['schemas']['EdgeRead'];

export const fromApiPayload = (
  nodes: ApiNode[],
  edges: ApiEdge[],
  positions: Record<string, { x: number; y: number }> = {},
  defaultTransition = 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)'
): { nodes: AppFlowNode[]; edges: AppFlowEdge[] } => {
  const slotToNodeId: Record<string, string> = {};
  nodes.forEach(n => {
    n.slots.forEach(s => {
      slotToNodeId[s.id] = n.id;
    });
  });

  const rfNodes = nodes.map(n => {
    const position = positions[n.id] || { x: 0, y: 0 };
    return {
      id: n.id,
      type: 'custom' as const,
      position,
      selected: n.selected ?? false,
      style: {
        transition: defaultTransition,
      },
      data: {
        node: n,
      },
    };
  });

  const rfEdges = edges
    .map(edge => {
      const sourceNodeId = edge.source_type === 'slot' ? slotToNodeId[edge.source_id] : edge.source_id;
      const targetNodeId = edge.target_type === 'slot' ? slotToNodeId[edge.target_id] : edge.target_id;

      if (!sourceNodeId || !targetNodeId) return null;

      return {
        id: edge.id,
        source: sourceNodeId,
        target: targetNodeId,
        sourceHandle: edge.source_id,
        targetHandle: edge.target_id,
        type: 'custom' as const,
        animated: true,
        data: {
          sections: [],
        },
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  return { nodes: rfNodes, edges: rfEdges };
};

export const toApiPayload = (
  state: Pick<GraphStoreState, 'graphId' | 'code' | 'nodes' | 'edges' | 'variables' | 'functions'>
) => {
  return {
    code: state.code,
    nodes: state.nodes.map(n => ({
      id: n.data.node.id,
      node_type: n.data.node.node_type,
      is_input: n.data.node.is_input ?? false,
      is_output: n.data.node.is_output ?? false,
      code: n.data.node.code ?? "",
      selected: false,
      slots: n.data.node.slots.map(s => ({
        id: s.id,
        raw_string: s.raw_string,
        selected: false,
      })),
    })),
    edges: state.edges.map(e => {
      const source_type = (e.sourceHandle === e.source ? 'node' : 'slot') as 'node' | 'slot';
      const target_type = (e.targetHandle === e.target ? 'node' : 'slot') as 'node' | 'slot';
      return {
        id: e.id,
        source_id: e.sourceHandle || '',
        source_type,
        target_id: e.targetHandle || '',
        target_type,
      };
    }),
    variables: state.variables.map(v => ({
      id: v.id,
      name: v.name,
      type: v.type,
      value: v.value,
    })),
    functions: state.functions.map(f => ({
      id: f.id,
      name: f.name,
      input_variable: f.input_variable,
      output_variable: f.output_variable,
      raw_string: f.raw_string,
    })),
  };
};
