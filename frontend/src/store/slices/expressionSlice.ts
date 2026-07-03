import type { StateCreator } from 'zustand';
import type { ApiExpression, AppFlowNode } from '../../components/types';
import { isValidOrder, runLayout } from '../../utils/flowUtils';
import { triggerSave, updateFlowState } from '../helpers';
import type { ExpressionSlice, GraphStoreState } from '../types';

export const createExpressionSlice: StateCreator<
  GraphStoreState,
  [],
  [],
  ExpressionSlice
> = (set, get) => ({
  createExpression: async (nodeId, isInput, isOutput, idx) => {
    await updateFlowState(set, get, (state) => {
      const { graphId } = get();
      if (!graphId) return state;

      const newExprId = crypto.randomUUID();
      const newExpr: ApiExpression = {
        id: newExprId,
        node_id: nodeId,
        graph_id: graphId,
        idx,
        is_input: isInput,
        is_output: isOutput,
        raw_string: '',
      };

      const nextExpressions = state.expressions.map(e => {
        if (e.node_id === nodeId && e.idx >= idx) {
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
      if (!expr) return state;

      const nodeExprs = state.expressions.filter(e => e.node_id === expr.node_id);
      if (nodeExprs.length <= 1) {
        alert('Cannot delete the last remaining expression of this node.');
        return state;
      }

      const deletedIdx = expr.idx;

      let nextExpressions = state.expressions.filter(e => e.id !== expressionId);
      nextExpressions = nextExpressions.map(e => {
        if (e.node_id === expr.node_id && e.idx > deletedIdx) {
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

  updateExpression: async (expressionId, updates) => {
    const currentExpr = get().expressions.find(e => e.id === expressionId);

    // 🧠 THE SMART GUARD:
    // If raw_string hasn't changed, halt execution right here.
    if (currentExpr && updates.raw_string === currentExpr.raw_string) {
      return;
    }

    // Only run this heavy, reference-breaking work if the text is ACTUALLY different
    set((state) => {
      const nextExpressions = state.expressions.map((e) =>
        e.id === expressionId ? { ...e, ...updates } : e
      );

      const expr = nextExpressions.find((e) => e.id === expressionId);
      const nextNodes = state.nodes.map((n) => {
        if (expr && n.id === expr.node_id) {
          const nodeExpressions = nextExpressions.filter((e) => e.node_id === n.id);
          return {
            ...n,
            data: { ...n.data, expressions: nodeExpressions },
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
    // After updating expression, recompute layout via ELK
    const { nodes, edges } = get();
    try {
      const laidOut = await runLayout(nodes, edges);
      set({ nodes: laidOut.nodes, edges: laidOut.edges });
    } catch (err) {
      console.error('Failed to run ELK layout after expression update:', err);
    }
  },

  swapExpressionIndices: async (expressionId, direction) => {
    await updateFlowState(set, get, (state) => {
      const expr = state.expressions.find(e => e.id === expressionId);
      if (!expr) return state;

      const nodeExprs = state.expressions
        .filter(e => e.node_id === expr.node_id)
        .sort((a, b) => a.idx - b.idx);

      const currentIndex = nodeExprs.findIndex(e => e.id === expressionId);
      if (currentIndex === -1) return state;

      let targetIndex = -1;
      if (direction === 'up' && currentIndex > 0) targetIndex = currentIndex - 1;
      else if (direction === 'down' && currentIndex < nodeExprs.length - 1) targetIndex = currentIndex + 1;

      if (targetIndex === -1) return state;

      const otherExpr = nodeExprs[targetIndex];

      const nextNodeExprs = [...nodeExprs];
      nextNodeExprs[currentIndex] = { ...otherExpr, idx: expr.idx };
      nextNodeExprs[targetIndex] = { ...expr, idx: otherExpr.idx };
      nextNodeExprs.sort((a, b) => a.idx - b.idx);

      if (!isValidOrder(nextNodeExprs)) {
        alert("Invalid order: expressions must follow the order: Inputs -> Both -> None -> Outputs.");
        return state;
      }

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
