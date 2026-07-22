import { create } from 'zustand';
import { getNextDownstreamNodeId, getNextUpstreamNodeId, getSiblingNodeId } from '../domain/graph/traversal';
import type { GraphStoreState } from './types';

export const useGraphStore = create<GraphStoreState>((set, get) => ({
  graphId: null,
  code: '',
  selectedNodeId: null,
  selectedEdgeId: null,

  init: (graphId) => {
    set({
      graphId,
      code: '',
      selectedNodeId: null,
      selectedEdgeId: null,
    });
  },

  setSelectedNodeId: (nodeId) => {
    const { graphId } = get();
    if (!graphId) return;

    if (nodeId === null) {
      set({ selectedNodeId: null, selectedEdgeId: null });
      return;
    }

    // Selecting a node ALWAYS deselects edges
    set({
      selectedNodeId: nodeId,
      selectedEdgeId: null,
    });
  },

  setSelectedEdgeId: (edgeId) => {
    // Selecting an edge ALWAYS deselects nodes
    set({
      selectedEdgeId: edgeId,
      selectedNodeId: null,
    });
  },

  handleEdgesChange: (changes) => {
    const selectChanges = changes.filter(
      (c): c is Extract<typeof changes[number], { type: 'select' }> => c.type === 'select'
    );
    const selectChange = selectChanges.find(c => c.selected);

    if (selectChange) {
      get().setSelectedEdgeId(selectChange.id);
    } else if (selectChanges.some(c => !c.selected)) {
      const currentEdgeId = get().selectedEdgeId;
      if (selectChanges.some(c => c.id === currentEdgeId && !c.selected)) {
        get().setSelectedEdgeId(null);
      }
    }
  },

  clearSelection: () => {
    set({ selectedNodeId: null, selectedEdgeId: null });
  },

  reconcileSelection: (newNodes) => {
    const { selectedNodeId } = get();
    if (!selectedNodeId) return;

    const node = newNodes.find(n => n.id === selectedNodeId);
    if (!node) {
      // Node was deleted: clear selection
      set({ selectedNodeId: null, selectedEdgeId: null });
    }
  },

  selectSiblingNode: (direction, nodes, edges) => {
    const { selectedNodeId } = get();
    if (!selectedNodeId) return;

    const siblingId = getSiblingNodeId(selectedNodeId, direction, nodes, edges);
    if (siblingId) {
      set({ selectedNodeId: siblingId });
    }
  },

  selectTraversalNode: (direction, nodes, edges) => {
    const { selectedNodeId } = get();
    if (!selectedNodeId) return;

    const targetId = direction === 'right'
      ? getNextDownstreamNodeId(selectedNodeId, nodes, edges)
      : getNextUpstreamNodeId(selectedNodeId, nodes, edges);

    if (targetId) {
      set({ selectedNodeId: targetId });
    }
  },
}));
