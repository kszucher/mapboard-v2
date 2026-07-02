import type { StateCreator } from 'zustand';
import { takeSnapshot, triggerSave } from '../helpers';
import type { GraphStoreState, HistorySlice } from '../types';

export const createHistorySlice: StateCreator<
  GraphStoreState,
  [],
  [],
  HistorySlice
> = (set, get) => ({
  undo: () => {
    const { past, future, nodes, edges, expressions, graphId } = get();
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    const currentSnapshot = takeSnapshot({ nodes, edges, expressions });

    set({
      nodes: previous.nodes,
      edges: previous.edges,
      expressions: previous.expressions,
      past: newPast,
      future: [currentSnapshot, ...future],
    });

    triggerSave(graphId, previous.nodes, previous.edges, previous.expressions);
  },

  redo: () => {
    const { past, future, nodes, edges, expressions, graphId } = get();
    if (future.length === 0) return;

    const next = future[0];
    const newFuture = future.slice(1);
    const currentSnapshot = takeSnapshot({ nodes, edges, expressions });

    set({
      nodes: next.nodes,
      edges: next.edges,
      expressions: next.expressions,
      past: [...past, currentSnapshot],
      future: newFuture,
    });

    triggerSave(graphId, next.nodes, next.edges, next.expressions);
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
});
