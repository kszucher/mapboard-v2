import type { EdgeChange, NodeChange } from '@xyflow/react';
import { applyEdgeChanges, applyNodeChanges, useReactFlow } from '@xyflow/react';
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
  const setSelectedIds = useGraphStore(state => state.setSelectedIds);
  const selectedNodeId = useGraphStore(state => state.selectedNodeId);
  const selectedEdgeId = useGraphStore(state => state.selectedEdgeId);
  const handleEdgesChange = useGraphStore(state => state.handleEdgesChange);
  const clearSelection = useGraphStore(state => state.clearSelection);
  const reconcileSelection = useGraphStore(state => state.reconcileSelection);

  // Sync React Flow node selection with Zustand store
  useEffect(() => {
    setNodes(nds =>
      nds.map(n => {
        const isSel = n.id === selectedNodeId;
        if (n.selected !== isSel) {
          return { ...n, selected: isSel };
        }
        return n;
      })
    );
  }, [selectedNodeId, setNodes]);

  // Sync React Flow edge selection with Zustand store
  useEffect(() => {
    setEdges(eds =>
      eds.map(e => {
        const isSel = e.id === selectedEdgeId;
        if (e.selected !== isSel) {
          return { ...e, selected: isSel };
        }
        return e;
      })
    );
  }, [selectedEdgeId, setEdges]);

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

    reconcileSelection(nodes);

    setNodes(nodes);
    setEdges(edges);

    runLayoutCalculation(nodes, edges);
  }, [query.data, runLayoutCalculation, setNodes, setEdges, getNodes, getEdges, reconcileSelection]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const currentNodes = getNodes() as AppFlowNode[];
      const currentEdges = getEdges() as AppFlowEdge[];
      const newNodes = applyNodeChanges(changes, currentNodes) as AppFlowNode[];

      const selectChanges = changes.filter(
        (c): c is Extract<NodeChange, { type: 'select' }> => c.type === 'select'
      );
      const selectChange = selectChanges.find(c => c.selected);

      if (selectChange) {
        setSelectedIds(selectChange.id, null);
      }

      if (changes.some(c => c.type === 'dimensions')) {
        runLayoutCalculation(newNodes, currentEdges);
      } else {
        setNodes(newNodes);
      }
    },
    [runLayoutCalculation, setNodes, getNodes, getEdges, setSelectedIds]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      handleEdgesChange(changes);
      setEdges(eds => applyEdgeChanges(changes, eds) as AppFlowEdge[]);
    },
    [handleEdgesChange, setEdges]
  );

  const onPaneClick = useCallback(() => {
    void clearSelection();
  }, [clearSelection]);

  return {
    ...query,
    isLoading,
    onNodesChange,
    onEdgesChange,
    onPaneClick,
  };
};
