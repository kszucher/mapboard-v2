import type { NodeChange } from '@xyflow/react';
import { applyNodeChanges, useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppFlowEdge, AppFlowNode } from '../../canvas/types';
import { runLayout } from '../../domain/graph/layout';
import { fromApiPayload } from '../../domain/graph/mappers';
import { useGraphStore } from '../../store/graphStore';
import { useGraphQuery } from './useGraphQuery';

export const useLaidOutGraph = (graphId: string) => {
  const query = useGraphQuery(graphId);
  const layoutSeqRef = useRef(0);
  const { setNodes: setRfNodes, setEdges: setRfEdges } = useReactFlow();

  const [graphState, setGraphState] = useState<{
    nodes: AppFlowNode[];
    edges: AppFlowEdge[];
    isLoading: boolean;
  }>({
    nodes: [],
    edges: [],
    isLoading: true,
  });

  const prevNodesRef = useRef<AppFlowNode[]>([]);
  const prevEdgesRef = useRef<AppFlowEdge[]>([]);

  const runLayoutCalculation = useCallback(
    (nodes: AppFlowNode[], edges: AppFlowEdge[]) => {
      const seq = ++layoutSeqRef.current;
      runLayout(nodes, edges).then(laidOut => {
        if (seq === layoutSeqRef.current) {
          prevNodesRef.current = laidOut.nodes;
          prevEdgesRef.current = laidOut.edges;
          setRfNodes(laidOut.nodes);
          setRfEdges(laidOut.edges);
          setGraphState({
            nodes: laidOut.nodes,
            edges: laidOut.edges,
            isLoading: false,
          });
        }
      });
    },
    [setRfNodes, setRfEdges]
  );

  useEffect(() => {
    if (!query.data) return;

    const prevNodes = prevNodesRef.current;
    const prevEdges = prevEdgesRef.current;

    const { nodes, edges } = fromApiPayload(
      query.data.nodes,
      query.data.edges,
      prevNodes,
      prevEdges
    );

    prevNodesRef.current = nodes;
    prevEdgesRef.current = edges;

    setRfNodes(nodes);
    setRfEdges(edges);
    setGraphState(prev => ({
      ...prev,
      nodes,
      edges,
    }));

    runLayoutCalculation(nodes, edges);
  }, [query.data, runLayoutCalculation, setRfNodes, setRfEdges]);

  const selectedNodeId = useGraphStore(state => state.selectedNodeId);
  const selectedSlotId = useGraphStore(state => state.selectedSlotId);

  const stitchedNodes = useMemo(
    () => stitchNodeSelection(graphState.nodes, selectedNodeId, selectedSlotId),
    [graphState.nodes, selectedNodeId, selectedSlotId]
  );

  const onNodesLayoutChange = useCallback(
    (changes: NodeChange[]) => {
      const prevNodes = prevNodesRef.current;
      const prevEdges = prevEdgesRef.current;
      const newNodes = applyNodeChanges(changes, prevNodes) as AppFlowNode[];

      if (
        changes.some(c => c.type === 'dimensions') &&
        shouldTriggerLayoutOnResize(prevNodes, newNodes, graphState.isLoading)
      ) {
        runLayoutCalculation(newNodes, prevEdges);
      }

      prevNodesRef.current = newNodes;
      setRfNodes(newNodes);
      setGraphState(prev => ({ ...prev, nodes: newNodes }));
    },
    [runLayoutCalculation, graphState.isLoading, setRfNodes]
  );

  return {
    ...query,
    nodes: stitchedNodes,
    edges: graphState.edges,
    isLoading: graphState.isLoading,
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
