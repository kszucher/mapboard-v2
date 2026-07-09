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
      const nextNodes = state.nodes.map(n => {
        if (n.id !== nodeId) return n;
        const expressions = [...n.data.node.expressions];
        const newExpr: ApiExpression = {
          id: crypto.randomUUID(),
          is_input: isInput,
          is_output: isOutput,
          raw_string: '',
        };
        expressions.splice(idx, 0, newExpr);
        return {
          ...n,
          data: {
            ...n.data,
            node: {
              ...n.data.node,
              expressions,
            }
          }
        };
      });

      return {
        nodes: nextNodes,
        edges: state.edges,
      };
    });
  },

  deleteExpression: async (expressionId) => {
    const node = get().nodes.find(n => n.data.node.expressions.some(e => e.id === expressionId));
    if (!node) return;

    if (node.data.node.expressions.length <= 1) {
      set({ errorMessage: 'Cannot delete the last remaining expression of this node.' });
      return;
    }

    await updateFlowState(set, get, (state) => {
      const nextNodes = state.nodes.map(n => {
        if (!n.data.node.expressions.some(e => e.id === expressionId)) return n;
        return {
          ...n,
          data: {
            ...n.data,
            node: {
              ...n.data.node,
              expressions: n.data.node.expressions.filter(e => e.id !== expressionId),
            }
          }
        };
      });

      const nextEdges = state.edges.filter(e => e.sourceHandle !== expressionId && e.targetHandle !== expressionId);

      return {
        nodes: nextNodes,
        edges: nextEdges,
      };
    });
  },

  updateExpression: async (expressionId, updates) => {
    const node = get().nodes.find(n => n.data.node.expressions.some(e => e.id === expressionId));
    if (!node) return;
    const currentExpr = node.data.node.expressions.find(e => e.id === expressionId);
    if (!currentExpr) return;

    const hasChanges = Object.entries(updates).some(
      ([key, value]) => currentExpr[key as keyof ApiExpression] !== value
    );
    if (!hasChanges) {
      return;
    }

    const shouldSkipHistory = !('is_input' in updates || 'is_output' in updates);

    await updateFlowState(set, get, (state) => {
      const nextNodes = state.nodes.map(n => {
        if (!n.data.node.expressions.some(e => e.id === expressionId)) return n;
        return {
          ...n,
          data: {
            ...n.data,
            node: {
              ...n.data.node,
              expressions: n.data.node.expressions.map(e =>
                e.id === expressionId ? { ...e, ...updates } : e
              ),
            }
          }
        };
      });

      let nextEdges = state.edges;
      if (updates.is_input === false) {
        nextEdges = nextEdges.filter(e => e.targetHandle !== expressionId);
      }
      if (updates.is_output === false) {
        nextEdges = nextEdges.filter(e => e.sourceHandle !== expressionId);
      }

      return {
        nodes: nextNodes,
        edges: nextEdges,
      };
    }, { skipHistory: shouldSkipHistory });
  },

  moveExpression: async (expressionId, direction) => {
    const node = get().nodes.find(n => n.data.node.expressions.some(e => e.id === expressionId));
    if (!node) return;

    const expressions = [...node.data.node.expressions];
    const currentIndex = expressions.findIndex(e => e.id === expressionId);
    if (currentIndex === -1) return;

    let targetIndex = -1;
    if (direction === 'up' && currentIndex > 0) targetIndex = currentIndex - 1;
    else if (direction === 'down' && currentIndex < expressions.length - 1) targetIndex = currentIndex + 1;
    else if (direction === 'top' && currentIndex > 0) targetIndex = 0;
    else if (direction === 'bottom' && currentIndex < expressions.length - 1) targetIndex = expressions.length - 1;

    if (targetIndex === -1 || targetIndex === currentIndex) return;

    await updateFlowState(set, get, (state) => {
      const nextNodes = state.nodes.map(n => {
        if (n.id !== node.id) return n;
        const exprs = [...n.data.node.expressions];
        const [moved] = exprs.splice(currentIndex, 1);
        exprs.splice(targetIndex, 0, moved);
        return {
          ...n,
          data: {
            ...n.data,
            node: {
              ...n.data.node,
              expressions: exprs,
            }
          }
        };
      });
      return {
        nodes: nextNodes,
        edges: state.edges,
      };
    });
  },
});
