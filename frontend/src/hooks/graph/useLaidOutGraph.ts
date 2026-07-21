import type { NodeChange } from '@xyflow/react';
import { applyNodeChanges } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppFlowEdge, AppFlowNode } from '../../canvas/types';
import { runLayout } from '../../domain/graph/layout';
import { fromApiPayload } from '../../domain/graph/mappers';
import { useGraphStore } from '../../store/graphStore';
import { useGraphQuery } from './useGraphQuery';

export const useLaidOutGraph = (graphId: string) => {
  const query = useGraphQuery(graphId);
  const layoutSeqRef = useRef(0);

  const [layout, setLayout] = useState<{
    nodes: AppFlowNode[];
    edges: AppFlowEdge[];
    isLoading: boolean;
  }>({
    nodes: [],
    edges: [],
    isLoading: true,
  });

  const runLayoutCalculation = useCallback((nodes: AppFlowNode[], edges: AppFlowEdge[]) => {
    const seq = ++layoutSeqRef.current;
    runLayout(nodes, edges).then(laidOut => {
      if (seq === layoutSeqRef.current) {
        setLayout({ nodes: laidOut.nodes, edges: laidOut.edges, isLoading: false });
      }
    });
  }, []);

  useEffect(() => {
    if (!query.data) return;

    setLayout(prev => {
      const { nodes, edges } = fromApiPayload(
        query.data.nodes,
        query.data.edges,
        prev.nodes,
        prev.edges
      );

      const hasNewNodes = nodes.some(n => !prev.nodes.some(pn => pn.id === n.id));

      // If there are new nodes, let ReactFlow render & measure them first.
      // onNodesLayoutChange will trigger ELK once real dimensions are available.
      if (!hasNewNodes) {
        runLayoutCalculation(nodes, edges);
      }

      return { ...prev, nodes, edges };
    });
  }, [query.data, runLayoutCalculation]);

  const selectedNodeId = useGraphStore(state => state.selectedNodeId);
  const selectedSlotId = useGraphStore(state => state.selectedSlotId);

  const stitchedNodes = useMemo(
    () => stitchNodeSelection(layout.nodes, selectedNodeId, selectedSlotId),
    [layout.nodes, selectedNodeId, selectedSlotId]
  );

  const onNodesLayoutChange = useCallback((changes: NodeChange[]) => {
    setLayout(prev => {
      const newNodes = applyNodeChanges(changes, prev.nodes) as AppFlowNode[];
      if (
        changes.some(c => c.type === 'dimensions') &&
        shouldTriggerLayoutOnResize(prev.nodes, newNodes, prev.isLoading)
      ) {
        runLayoutCalculation(newNodes, prev.edges);
      }
      return { ...prev, nodes: newNodes };
    });
  }, [runLayoutCalculation]);

  return {
    ...query,
    nodes: stitchedNodes,
    edges: layout.edges,
    isLoading: layout.isLoading,
    onNodesLayoutChange,
  };
};

const shouldTriggerLayoutOnResize = (
  prevNodes: AppFlowNode[],
  newNodes: AppFlowNode[],
  isLoading: boolean
): boolean => {
  if (isLoading) {
    return (
      newNodes.length > 0 &&
      newNodes.every(n => n.measured?.width !== undefined && n.measured?.height !== undefined)
    );
  }

  return newNodes.some(node => {
    const prevNode = prevNodes.find(n => n.id === node.id);
    if (!prevNode) return true;
    return (
      node.measured?.width !== prevNode.measured?.width ||
      node.measured?.height !== prevNode.measured?.height
    );
  });
};

const stitchNodeSelection = (
  nodes: AppFlowNode[],
  selectedNodeId: string | null,
  selectedSlotId: string | null
): AppFlowNode[] =>
  nodes.map(n => {
    const isNodeSelected = n.id === selectedNodeId;
    const slots = n.data.node.slots.map(s => ({ ...s, selected: s.id === selectedSlotId }));
    return {
      ...n,
      selected: isNodeSelected,
      data: {
        ...n.data,
        node: { ...n.data.node, selected: isNodeSelected, slots },
      },
    };
  });
