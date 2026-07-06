import type { StateCreator } from 'zustand';
import type { ApiExpression } from '../../components/types';
import { updateFlowState } from '../helpers';
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
    const expr = get().expressions.find(e => e.id === expressionId);
    if (!expr) return;

    const nodeExprs = get().expressions.filter(e => e.node_id === expr.node_id);
    if (nodeExprs.length <= 1) {
      set({ errorMessage: 'Cannot delete the last remaining expression of this node.' });
      return;
    }

    await updateFlowState(set, get, (state) => {
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
    if (!currentExpr) return;

    // Check for changes across all updated fields
    const hasChanges = Object.entries(updates).some(
      ([key, value]) => currentExpr[key as keyof ApiExpression] !== value
    );
    if (!hasChanges) {
      return;
    }

    const shouldSkipHistory = !('is_input' in updates || 'is_output' in updates);

    await updateFlowState(set, get, (state) => {
      const nextExpressions = state.expressions.map((e) =>
        e.id === expressionId ? { ...e, ...updates } : e
      );

      let nextEdges = state.edges;
      if (updates.is_input === false) {
        nextEdges = nextEdges.filter(e => e.targetHandle !== expressionId);
      }
      if (updates.is_output === false) {
        nextEdges = nextEdges.filter(e => e.sourceHandle !== expressionId);
      }

      return {
        nodes: state.nodes,
        edges: nextEdges,
        expressions: nextExpressions,
      };
    }, { skipHistory: shouldSkipHistory });
  },

  moveExpression: async (expressionId, direction) => {
    const expr = get().expressions.find(e => e.id === expressionId);
    if (!expr) return;

    const nodeExprs = get().expressions
      .filter(e => e.node_id === expr.node_id)
      .sort((a, b) => a.idx - b.idx);

    const currentIndex = nodeExprs.findIndex(e => e.id === expressionId);
    if (currentIndex === -1) return;

    if (direction === 'up' || direction === 'down') {
      let targetIndex = -1;
      if (direction === 'up' && currentIndex > 0) targetIndex = currentIndex - 1;
      else if (direction === 'down' && currentIndex < nodeExprs.length - 1) targetIndex = currentIndex + 1;

      if (targetIndex === -1) return;
      const otherExpr = nodeExprs[targetIndex];

      await updateFlowState(set, get, (state) => {
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
    } else if (direction === 'top') {
      if (currentIndex === 0) return;
      await updateFlowState(set, get, (state) => {
        const nextExpressions = state.expressions.map(e => {
          if (e.node_id !== expr.node_id) return e;
          if (e.id === expr.id) {
            return { ...e, idx: 0 };
          }
          if (e.idx < currentIndex) {
            return { ...e, idx: e.idx + 1 };
          }
          return e;
        });
        return {
          nodes: state.nodes,
          edges: state.edges,
          expressions: nextExpressions,
        };
      });
    } else if (direction === 'bottom') {
      if (currentIndex === nodeExprs.length - 1) return;
      await updateFlowState(set, get, (state) => {
        const nextExpressions = state.expressions.map(e => {
          if (e.node_id !== expr.node_id) return e;
          if (e.id === expr.id) {
            return { ...e, idx: nodeExprs.length - 1 };
          }
          if (e.idx > currentIndex) {
            return { ...e, idx: e.idx - 1 };
          }
          return e;
        });
        return {
          nodes: state.nodes,
          edges: state.edges,
          expressions: nextExpressions,
        };
      });
    }
  },
});
