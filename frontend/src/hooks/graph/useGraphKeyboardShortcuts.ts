import { useReactFlow } from '@xyflow/react';
import { useEffect, useRef } from 'react';
import type { AppFlowEdge, AppFlowNode } from '../../canvas/types';
import { useGraphStore } from '../../store/graphStore';
import { useDeleteEdge, useDeleteNode } from './useGraphMutations';

export const useGraphKeyboardShortcuts = (graphId: string) => {
  const { getNodes, getEdges } = useReactFlow();
  const selectedNodeId = useGraphStore(state => state.selectedNodeId);
  const selectedEdgeId = useGraphStore(state => state.selectedEdgeId);
  const selectSiblingNode = useGraphStore(state => state.selectSiblingNode);
  const selectTraversalNode = useGraphStore(state => state.selectTraversalNode);

  const { mutateAsync: deleteNode } = useDeleteNode(graphId);
  const { mutateAsync: deleteEdge } = useDeleteEdge(graphId);

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

      if (selectedNodeId !== null) {
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
    selectedEdgeId,
    selectSiblingNode,
    selectTraversalNode,
    deleteNode,
    deleteEdge,
  ]);
};
