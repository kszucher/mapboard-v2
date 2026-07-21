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
  const clearSlotSelection = useGraphStore(state => state.clearSlotSelection);
  const clearNodeSelection = useGraphStore(state => state.clearNodeSelection);

  const runLayoutCalculation = useCallback(
    (nodes: AppFlowNode[], edges: AppFlowEdge[]) => {
      // Sequence ticket counter: discards out-of-order async worker layout responses
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

    const selNodeId = useGraphStore.getState().selectedNodeId;
    const selSlotId = useGraphStore.getState().selectedSlotId;

    const isNodeMissing = selNodeId && !nodes.some(n => n.id === selNodeId);
    const isSlotMissing = selSlotId && !nodes.some(n => n.data.node.slots.some(s => s.id === selSlotId));

    if (isNodeMissing) {
      void clearNodeSelection();
    } else if (isSlotMissing) {
      void clearSlotSelection();
    }

    setNodes(nodes);
    setEdges(edges);

    runLayoutCalculation(nodes, edges);
  }, [query.data, runLayoutCalculation, setNodes, setEdges, getNodes, getEdges, clearSlotSelection, clearNodeSelection]);

  const onNodesLayoutChange = useCallback(
    (changes: NodeChange[]) => {
      const currentNodes = getNodes() as AppFlowNode[];
      const currentEdges = getEdges() as AppFlowEdge[];
      const newNodes = applyNodeChanges(changes, currentNodes) as AppFlowNode[];

      if (changes.some(c => c.type === 'dimensions')) {
        runLayoutCalculation(newNodes, currentEdges);
      } else {
        setNodes(newNodes);
      }
    },
    [runLayoutCalculation, setNodes, getNodes, getEdges]
  );

  return {
    ...query,
    isLoading,
    onNodesLayoutChange,
  };
};
