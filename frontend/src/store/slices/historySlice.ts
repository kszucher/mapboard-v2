import type { StateCreator } from 'zustand';
import { runLayout } from '../../utils/flowUtils';
import { takeSnapshot, triggerSave } from '../helpers';
import type { GraphStoreState, HistorySlice } from '../types';
export const createHistorySlice: StateCreator<
  GraphStoreState,
  [],
  [],
  HistorySlice
> = (set, get) => ({
  undo: () => {
    const { past, future, code, nodes, edges, variables, functions, graphId } = get();
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    const currentSnapshot = takeSnapshot({ code, nodes, edges, variables, functions });

    const currentPositions = Object.fromEntries(nodes.map(n => [n.id, n.position]));
    const nodesAtCurrentPositions = previous.nodes.map(n => ({
      ...n,
      position: currentPositions[n.id] ?? n.position,
    }));

    runLayout(nodesAtCurrentPositions, previous.edges).then((laidOut) => {
      set({
        code: previous.code,
        nodes: laidOut.nodes,
        edges: laidOut.edges,
        variables: previous.variables,
        functions: previous.functions,
        past: newPast,
        future: [currentSnapshot, ...future],
      });

      triggerSave({
        graphId,
        code: previous.code,
        nodes: laidOut.nodes,
        edges: laidOut.edges,
        variables: previous.variables,
        functions: previous.functions,
      });
    });
  },

  redo: () => {
    const { past, future, code, nodes, edges, variables, functions, graphId } = get();
    if (future.length === 0) return;

    const next = future[0];
    const newFuture = future.slice(1);
    const currentSnapshot = takeSnapshot({ code, nodes, edges, variables, functions });

    const currentPositions = Object.fromEntries(nodes.map(n => [n.id, n.position]));
    const nodesAtCurrentPositions = next.nodes.map(n => ({
      ...n,
      position: currentPositions[n.id] ?? n.position,
    }));

    runLayout(nodesAtCurrentPositions, next.edges).then((laidOut) => {
      set({
        code: next.code,
        nodes: laidOut.nodes,
        edges: laidOut.edges,
        variables: next.variables,
        functions: next.functions,
        past: [...past, currentSnapshot],
        future: newFuture,
      });

      triggerSave({
        graphId,
        code: next.code,
        nodes: laidOut.nodes,
        edges: laidOut.edges,
        variables: next.variables,
        functions: next.functions,
      });
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
});
