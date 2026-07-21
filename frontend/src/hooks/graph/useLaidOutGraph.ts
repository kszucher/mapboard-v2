import type { NodeChange } from '@xyflow/react';
import { applyNodeChanges, useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppFlowEdge, AppFlowNode } from '../../canvas/types';
import { runLayout } from '../../domain/graph/layout';
import { fromApiPayload } from '../../domain/graph/mappers';
import { useGraphStore } from '../../store/graphStore';
import { useGraphQuery } from './useGraphQuery';

export const useLaidOutGraph = (graphId: string) => {
  const query = useGraphQuery(graphId);
  const layoutSeqRef = useRef(0);
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow();

  const [isLoading, setIsLoading] = useState(true);

  const selectedNodeId = useGraphStore(state => state.selectedNodeId);
  const selectedSlotId = useGraphStore(state => state.selectedSlotId);
  const clearSlotSelection = useGraphStore(state => state.clearSlotSelection);

  const runLayoutCalculation = useCallback(
    (nodes: AppFlowNode[], edges: AppFlowEdge[]) => {
      const seq = ++layoutSeqRef.current;
      runLayout(nodes, edges).then(laidOut => {
        if (seq === layoutSeqRef.current) {
          setNodes(laidOut.nodes);
          setEdges(laidOut.edges);
          setIsLoading(false);
        }
      });
    },
    [setNodes, setEdges]
  );

  useEffect(() => {
    if (!query.data) return;

    const currentNodes = getNodes() as AppFlowNode[];
    const currentEdges = getEdges() as AppFlowEdge[];

    const { nodes, edges } = fromApiPayload(
      query.data.nodes,
      query.data.edges,
      currentNodes,
      currentEdges
    );

    // Safety check: clear selection if selected node/slot no longer exists in graph
    if (selectedNodeId && !nodes.some(n => n.id === selectedNodeId)) {
      void clearSlotSelection();
    } else if (selectedSlotId && !nodes.some(n => n.data.node.slots.some(s => s.id === selectedSlotId))) {
      void clearSlotSelection();
    }

    setNodes(nodes);
    setEdges(edges);

    runLayoutCalculation(nodes, edges);
  }, [query.data, runLayoutCalculation, setNodes, setEdges, getNodes, getEdges, selectedNodeId, selectedSlotId, clearSlotSelection]);

  const onNodesLayoutChange = useCallback(
    (changes: NodeChange[]) => {
      const currentNodes = getNodes() as AppFlowNode[];
      const currentEdges = getEdges() as AppFlowEdge[];
      const newNodes = applyNodeChanges(changes, currentNodes) as AppFlowNode[];

      if (
        changes.some(c => c.type === 'dimensions') &&
        shouldTriggerLayoutOnResize(currentNodes, newNodes, isLoading)
      ) {
        runLayoutCalculation(newNodes, currentEdges);
      }

      setNodes(newNodes);
    },
    [runLayoutCalculation, isLoading, setNodes, getNodes, getEdges]
  );

  return {
    ...query,
    isLoading,
    onNodesLayoutChange,
  };
};

const shouldTriggerLayoutOnResize = (
  prevNodes: AppFlowNode[],
  newNodes: AppFlowNode[],
  isLoading: boolean
): boolean => {
  if (isLoading) return true;

  return newNodes.some(node => {
    const prevNode = prevNodes.find(n => n.id === node.id);
    if (!prevNode) return true;
    return (
      node.measured?.width !== prevNode.measured?.width ||
      node.measured?.height !== prevNode.measured?.height
    );
  });
};
