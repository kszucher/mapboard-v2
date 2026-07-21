import { useReactFlow } from '@xyflow/react';
import { useEffect } from 'react';
import type { AppFlowEdge, AppFlowNode } from '../../canvas/types';
import { getNextDownstreamNodeId, getNextUpstreamNodeId, getSiblingNodeId, } from '../../domain/graph/traversal';
import { useGraphStore } from '../../store/graphStore';
import { useCreateSlot, useDeleteNode, useDeleteSlot, useMoveSlot, } from './useGraphMutations';

export const useGraphKeyboardShortcuts = (graphId: string) => {
  const { getNodes, getEdges } = useReactFlow();
  const selectedNodeId = useGraphStore(state => state.selectedNodeId);
  const selectedSlotId = useGraphStore(state => state.selectedSlotId);
  const selectedSlotIndex = useGraphStore(state => state.selectedSlotIndex);
  const setSelectedIds = useGraphStore(state => state.setSelectedIds);
  const clearSlotSelection = useGraphStore(state => state.clearSlotSelection);

  const { mutateAsync: createSlot } = useCreateSlot(graphId);
  const { mutateAsync: deleteSlot } = useDeleteSlot(graphId);
  const { mutateAsync: deleteNode } = useDeleteNode(graphId);
  const { mutateAsync: moveSlot } = useMoveSlot(graphId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Do not trigger global canvas navigation if user is actively typing in text input/textarea
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const nodes = getNodes() as AppFlowNode[];
      const edges = getEdges() as AppFlowEdge[];

      // ----------------------------------------------------
      // 1. SLOT IS SELECTED
      // ----------------------------------------------------
      if (selectedSlotId !== null && selectedNodeId !== null) {
        const currentNode = nodes.find(n => n.id === selectedNodeId);
        if (!currentNode) return;

        const slots = currentNode.data.node.slots || [];
        const currentIndex = selectedSlotIndex ?? slots.findIndex(s => s.id === selectedSlotId);

        if (e.key === 'Backspace' || e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          // Deselect slot and return selection to parent node
          void clearSlotSelection();
          return;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          if (e.ctrlKey) {
            void moveSlot({ slotId: selectedSlotId, direction: 'up' });
          } else if (currentIndex > 0) {
            setSelectedIds(selectedNodeId, currentIndex - 1);
          }
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          if (e.ctrlKey) {
            void moveSlot({ slotId: selectedSlotId, direction: 'down' });
          } else if (currentIndex < slots.length - 1) {
            setSelectedIds(selectedNodeId, currentIndex + 1);
          }
          return;
        }

        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          if (currentIndex !== -1) {
            if (e.shiftKey) {
              void createSlot({ nodeId: selectedNodeId, index: currentIndex });
            } else {
              void createSlot({ nodeId: selectedNodeId, index: currentIndex + 1 });
            }
          }
          return;
        }

        if (e.key === 'Delete') {
          e.preventDefault();
          e.stopPropagation();
          void deleteSlot(selectedSlotId);
          return;
        }

        return;
      }

      // ----------------------------------------------------
      // 2. NODE IS SELECTED (NO SLOT SELECTED)
      // ----------------------------------------------------
      if (selectedNodeId !== null && selectedSlotId === null) {
        const currentNode = nodes.find(n => n.id === selectedNodeId);
        if (!currentNode) return;

        // Space: Transition from node selection to first slot selection
        if (e.key === ' ' || e.code === 'Space') {
          const slots = currentNode.data.node.slots || [];
          if (slots.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            setSelectedIds(selectedNodeId, 0);
            return;
          }
        }

        if (e.key === 'Delete') {
          e.preventDefault();
          e.stopPropagation();
          void deleteNode(selectedNodeId);
          setSelectedIds(null, null);
          return;
        }

        // Topological Node Traversal
        if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();

          let nextNodeId: string | null = null;
          if (e.key === 'ArrowRight') {
            nextNodeId = getNextDownstreamNodeId(selectedNodeId, nodes, edges);
          } else if (e.key === 'ArrowLeft') {
            nextNodeId = getNextUpstreamNodeId(selectedNodeId, nodes, edges);
          } else if (e.key === 'ArrowUp') {
            nextNodeId = getSiblingNodeId(selectedNodeId, 'above', nodes, edges);
          } else if (e.key === 'ArrowDown') {
            nextNodeId = getSiblingNodeId(selectedNodeId, 'below', nodes, edges);
          }

          if (nextNodeId) {
            setSelectedIds(nextNodeId, null);
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
    graphId,
    getNodes,
    getEdges,
    selectedNodeId,
    selectedSlotId,
    selectedSlotIndex,
    setSelectedIds,
    clearSlotSelection,
    createSlot,
    deleteSlot,
    deleteNode,
    moveSlot,
  ]);
};
