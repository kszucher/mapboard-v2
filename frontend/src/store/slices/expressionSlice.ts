import type { StateCreator } from 'zustand';
import type { ApiExpression, AppFlowNode } from '../../components/types';
import type { GraphStoreState } from '../types';
import { getNodeDimensions } from '../../components/layout';
import { updateFlowState, triggerSave } from '../helpers';

export interface ExpressionSlice {
  createExpression: (nodeId: string, type: string, idx: number) => Promise<void>;
  deleteExpression: (expressionId: string) => Promise<void>;
  updateExpression: (expressionId: string, raw_string: string) => void;
  swapExpressionIndices: (expressionId: string, direction: 'up' | 'down') => Promise<void>;
}

export const createExpressionSlice: StateCreator<
  GraphStoreState,
  [],
  [],
  ExpressionSlice
> = (set, get) => ({
  createExpression: async (nodeId, type, idx) => {
    await updateFlowState(set, get, (state) => {
      const { graphId } = get();
      if (!graphId) return state;

      const newExprId = crypto.randomUUID();
      const newExpr: ApiExpression = {
        id: newExprId,
        node_id: nodeId,
        graph_id: graphId,
        idx,
        type,
        raw_string: '',
      };

      const nextExpressions = state.expressions.map(e => {
        if (e.node_id === nodeId && e.type === type && e.idx >= idx) {
          return { ...e, idx: e.idx + 1 };
        }
        return e;
      });
      nextExpressions.push(newExpr);

      return {
        nodes: state.nodes,
        edges: state.edges,
        expressions: nextExpressions,
      };
    });
  },

  deleteExpression: async (expressionId) => {
    await updateFlowState(set, get, (state) => {
      const expr = state.expressions.find(e => e.id === expressionId);
      if (!expr || expr.type.startsWith('BASE_')) return state;

      const nodeExprs = state.expressions.filter(e => e.node_id === expr.node_id && e.type === expr.type);
      if (nodeExprs.length <= 1) {
        alert('Cannot delete the last remaining expression of this type.');
        return state;
      }

      const deletedIdx = expr.idx;

      let nextExpressions = state.expressions.filter(e => e.id !== expressionId);
      nextExpressions = nextExpressions.map(e => {
        if (e.node_id === expr.node_id && e.type === expr.type && e.idx > deletedIdx) {
          return { ...e, idx: e.idx - 1 };
        }
        return e;
      });

      const nextEdges = state.edges.filter(e => e.sourceHandle !== expressionId && e.targetHandle !== expressionId);

      return {
        nodes: state.nodes,
        edges: nextEdges,
        expressions: nextExpressions,
      };
    });
  },

  updateExpression: (expressionId, raw_string) => {
    set((state) => {
      const nextExpressions = state.expressions.map((e) =>
        e.id === expressionId ? { ...e, raw_string } : e
      );

      const expr = nextExpressions.find((e) => e.id === expressionId);
      const nextNodes = state.nodes.map((n) => {
        if (expr && n.id === expr.node_id) {
          const nodeExpressions = nextExpressions.filter((e) => e.node_id === n.id);
          const { width, height } = getNodeDimensions(n.data?.node?.node_type ?? 'LOGIC', nodeExpressions);
          return {
            ...n,
            style: { ...n.style, width, height },
            data: { ...n.data, expressions: nodeExpressions }
          };
        }
        return n;
      });

      triggerSave(state.graphId, nextNodes, state.edges, nextExpressions);

      return {
        nodes: nextNodes as AppFlowNode[],
        expressions: nextExpressions,
      };
    });
  },

  swapExpressionIndices: async (expressionId, direction) => {
    await updateFlowState(set, get, (state) => {
      const expr = state.expressions.find(e => e.id === expressionId);
      if (!expr || expr.type.startsWith('BASE_')) return state;

      const nodeSameTypeExprs = state.expressions
        .filter(e => e.node_id === expr.node_id && e.type === expr.type)
        .sort((a, b) => a.idx - b.idx);

      const currentIndex = nodeSameTypeExprs.findIndex(e => e.id === expressionId);
      if (currentIndex === -1) return state;

      let targetIndex = -1;
      if (direction === 'up' && currentIndex > 0) targetIndex = currentIndex - 1;
      else if (direction === 'down' && currentIndex < nodeSameTypeExprs.length - 1) targetIndex = currentIndex + 1;

      if (targetIndex === -1) return state;

      const otherExpr = nodeSameTypeExprs[targetIndex];

      const nextExpressions = state.expressions.map(e => {
        if (e.id === expr.id) {
          return { ...e, idx: otherExpr.idx };
        }
        if (e.id === otherExpr.id) {
          return { ...e, idx: expr.idx };
        }
        return e;
      });

      return {
        nodes: state.nodes,
        edges: state.edges,
        expressions: nextExpressions,
      };
    });
  },
});
