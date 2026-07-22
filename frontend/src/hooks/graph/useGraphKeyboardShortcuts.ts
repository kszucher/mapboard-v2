import { useReactFlow } from '@xyflow/react';
import { useEffect, useRef } from 'react';
import type { AppFlowEdge, AppFlowNode } from '../../canvas/types';
import { useGraphStore } from '../../store/graphStore';
import { useCreateSlot, useDeleteEdge, useDeleteNode, useDeleteSlot, useMoveSlot, } from './useGraphMutations';

export const useGraphKeyboardShortcuts = (graphId: string) => {
  const { getNodes, getEdges } = useReactFlow();
  const selectedNodeId = useGraphStore(state => state.selectedNodeId);
  const selectedSlotId = useGraphStore(state => state.selectedSlotId);
  const selectedEdgeId = useGraphStore(state => state.selectedEdgeId);
  const clearSlotSelection = useGraphStore(state => state.clearSlotSelection);
  const selectNextSlot = useGraphStore(state => state.selectNextSlot);
  const selectPreviousSlot = useGraphStore(state => state.selectPreviousSlot);
  const selectFirstSlot = useGraphStore(state => state.selectFirstSlot);
  const selectSiblingNode = useGraphStore(state => state.selectSiblingNode);
  const selectTraversalNode = useGraphStore(state => state.selectTraversalNode);

  const { mutateAsync: createSlot } = useCreateSlot(graphId);
  const { mutateAsync: deleteSlot } = useDeleteSlot(graphId);
  const { mutateAsync: deleteNode } = useDeleteNode(graphId);
  const { mutateAsync: deleteEdge } = useDeleteEdge(graphId);
  const { mutateAsync: moveSlot } = useMoveSlot(graphId);

  const isMutatingRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const nodes = getNodes() as AppFlowNode[];
      const edges = getEdges() as AppFlowEdge[];

      if (selectedEdgeId !== null) {
        if (e.key === 'Delete') {
          e.preventDefault();
          e.stopPropagation();
          if (isMutatingRef.current) return;
          isMutatingRef.current = true;
          try {
            await deleteEdge(selectedEdgeId);
          } finally {
            isMutatingRef.current = false;
          }
          return;
        }
      }

      // ----------------------------------------------------
      // 1. SLOT IS SELECTED
      // ----------------------------------------------------
      if (selectedSlotId !== null && selectedNodeId !== null) {
        const currentNode = nodes.find(n => n.id === selectedNodeId);
        if (!currentNode) return;

        const slots = currentNode.data.node.slots || [];
        const currentIndex = slots.findIndex(s => s.id === selectedSlotId);

        if (e.key === 'Backspace' || e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          // Deselect slot and return selection to parent node
          void clearSlotSelection();
          return;
        }

        if (e.key === 'ArrowUp' && e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          if (isMutatingRef.current) return;
          isMutatingRef.current = true;
          try {
            await moveSlot({ slotId: selectedSlotId, direction: 'up' });
          } finally {
            isMutatingRef.current = false;
          }
          return;
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          selectPreviousSlot(nodes);
          return;
        }

        if (e.key === 'ArrowDown' && e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          if (isMutatingRef.current) return;
          isMutatingRef.current = true;
          try {
            await moveSlot({ slotId: selectedSlotId, direction: 'down' });
          } finally {
            isMutatingRef.current = false;
          }
          return;
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          selectNextSlot(nodes);
          return;
        }

        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          if (currentIndex !== -1) {
            if (isMutatingRef.current) return;
            isMutatingRef.current = true;
            try {
              if (e.shiftKey) {
                await createSlot({ nodeId: selectedNodeId, index: currentIndex });
              } else {
                await createSlot({ nodeId: selectedNodeId, index: currentIndex + 1 });
              }
            } finally {
              isMutatingRef.current = false;
            }
          }
          return;
        }

        if (e.key === 'Delete') {
          e.preventDefault();
          e.stopPropagation();
          if (isMutatingRef.current) return;
          isMutatingRef.current = true;
          try {
            await deleteSlot(selectedSlotId);
          } finally {
            isMutatingRef.current = false;
          }
          return;
        }

        return;
      }

      // ----------------------------------------------------
      // 2. NODE IS SELECTED (NO SLOT SELECTED)
      // ----------------------------------------------------
      if (selectedNodeId !== null && selectedSlotId === null) {
        // Space: Transition from node selection to first slot selection
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          e.stopPropagation();
          selectFirstSlot(nodes);
          return;
        }

        if (e.key === 'Delete') {
          e.preventDefault();
          e.stopPropagation();
          if (isMutatingRef.current) return;
          isMutatingRef.current = true;
          try {
            await deleteNode(selectedNodeId);
          } finally {
            isMutatingRef.current = false;
          }
          return;
        }

        // Topological Node Traversal
        if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();

          if (e.key === 'ArrowRight') {
            selectTraversalNode('right', nodes, edges);
          } else if (e.key === 'ArrowLeft') {
            selectTraversalNode('left', nodes, edges);
          } else if (e.key === 'ArrowUp') {
            selectSiblingNode('above', nodes, edges);
          } else if (e.key === 'ArrowDown') {
            selectSiblingNode('below', nodes, edges);
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [
    getNodes,
    getEdges,
    selectedNodeId,
    selectedSlotId,
    selectedEdgeId,
    clearSlotSelection,
    selectNextSlot,
    selectPreviousSlot,
    selectFirstSlot,
    selectSiblingNode,
    selectTraversalNode,
    createSlot,
    deleteSlot,
    deleteNode,
    deleteEdge,
    moveSlot,
  ]);
};
