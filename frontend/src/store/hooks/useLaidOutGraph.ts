import { useQuery } from '@tanstack/react-query';
import type { NodeChange } from '@xyflow/react';
import { applyNodeChanges } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppFlowEdge, AppFlowNode } from '../../components/types';
import { graphQueries } from '../../api/queries/graphs';
import { runLayout } from '../layout';
import { fromApiPayload } from '../mappers';
import { useGraphStore } from '../useGraphStore';
import type { components } from '../../api/generated/schema';

type GraphFlowRead = components['schemas']['GraphFlowRead'];

export const useGraphQuery = (graphId: string) => {
  return useQuery(graphQueries.flow(graphId));
};

export const useLaidOutGraph = (graphId: string) => {
  const query = useGraphQuery(graphId);
  const layoutSeqRef = useRef(0);

  const [layoutResult, setLayoutResult] = useState<{
    nodes: AppFlowNode[];
    edges: AppFlowEdge[];
    isLoading: boolean;
  }>({
    nodes: [],
    edges: [],
    isLoading: true,
  });

  const triggerLayout = useCallback((nodes: AppFlowNode[], edges: AppFlowEdge[]) => {
    const seq = ++layoutSeqRef.current;
    runLayout(nodes, edges).then(laidOut => {
      if (seq !== layoutSeqRef.current) return;
      setLayoutResult({
        nodes: laidOut.nodes,
        edges: laidOut.edges,
        isLoading: false,
      });
    });
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setLayoutResult(prev => {
      const newNodes = applyNodeChanges(changes, prev.nodes) as AppFlowNode[];
      const hasDimensionsChange = changes.some(c => c.type === 'dimensions');

      if (hasDimensionsChange && shouldTriggerLayoutOnResize(prev.nodes, newNodes, prev.isLoading)) {
        triggerLayout(newNodes, prev.edges);
      }

      return { ...prev, nodes: newNodes };
    });
  }, [triggerLayout]);

  useEffect(() => {
    if (!query.data) return;

    setLayoutResult(prev => {
      const isNewGraph = prev.nodes.length === 0 || !prev.nodes.some(n => query.data.nodes.some(qn => qn.id === n.id));
      const { nodes, edges } = stitchQueryData(prev, query.data);

      if (isNewGraph) {
        return { nodes, edges, isLoading: true };
      } else {
        triggerLayout(nodes, edges);
        return { ...prev, nodes, edges };
      }
    });
  }, [query.data, triggerLayout]);

  const selectedNodeId = useGraphStore(state => state.selectedNodeId);
  const selectedSlotId = useGraphStore(state => state.selectedSlotId);

  // Stitch selection states reactively without triggering ELK re-layouts
  const stitchedNodes = useMemo(() => {
    return stitchNodeSelection(layoutResult.nodes, selectedNodeId, selectedSlotId);
  }, [layoutResult.nodes, selectedNodeId, selectedSlotId]);

  return {
    ...query,
    nodes: stitchedNodes,
    edges: layoutResult.edges,
    isLoading: layoutResult.isLoading,
    onNodesChange,
  };
};

const shouldTriggerLayoutOnResize = (
  prevNodes: AppFlowNode[],
  newNodes: AppFlowNode[],
  isLoading: boolean
): boolean => {
  if (isLoading) {
    return newNodes.length > 0 && newNodes.every(
      n => n.measured?.width !== undefined && n.measured?.height !== undefined
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

const stitchQueryData = (
  prev: { nodes: AppFlowNode[]; edges: AppFlowEdge[] },
  queryData: GraphFlowRead
): { nodes: AppFlowNode[]; edges: AppFlowEdge[] } => {
  return fromApiPayload(queryData.nodes, queryData.edges, prev.nodes, prev.edges);
};

const stitchNodeSelection = (
  nodes: AppFlowNode[],
  selectedNodeId: string | null,
  selectedSlotId: string | null
): AppFlowNode[] => {
  return nodes.map(n => {
    const isNodeSelected = n.id === selectedNodeId;
    const slots = n.data.node.slots.map(s => ({
      ...s,
      selected: s.id === selectedSlotId,
    }));
    return {
      ...n,
      selected: isNodeSelected,
      data: {
        ...n.data,
        node: {
          ...n.data.node,
          selected: isNodeSelected,
          slots,
        }
      }
    };
  });
};
