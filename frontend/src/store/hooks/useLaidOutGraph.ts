import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { NodeChange } from '@xyflow/react';
import { applyNodeChanges } from '@xyflow/react';
import { apiClient } from '../../api/client';
import { fromApiPayload } from '../mappers';
import { runLayout } from '../layout';
import type { AppFlowNode, AppFlowEdge } from '../../components/types';
import { useGraphStore } from '../useGraphStore';

export const useGraphQuery = (graphId: string) => {
  return useQuery({
    queryKey: ['graph', graphId],
    queryFn: async () => {
      const res = await apiClient.GET('/graphs/{graph_id}/flow', {
        params: { path: { graph_id: graphId } }
      });
      if ('error' in res) throw res.error;
      return res.data;
    },
    enabled: !!graphId,
  });
};

export const useLaidOutGraph = (graphId: string) => {
  const query = useGraphQuery(graphId);

  const [layoutResult, setLayoutResult] = useState<{
    nodes: AppFlowNode[];
    edges: AppFlowEdge[];
    isLoading: boolean;
  }>({
    nodes: [],
    edges: [],
    isLoading: true,
  });

  const pendingLayoutNodeIdRef = useRef<string | null>(null);

  const triggerLayout = useCallback((nodes: AppFlowNode[], edges: AppFlowEdge[]) => {
    runLayout(nodes, edges).then(laidOut => {
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
      if (hasDimensionsChange) {
        if (prev.isLoading) {
          const allMeasured = newNodes.length > 0 && newNodes.every(
            n => n.measured?.width !== undefined && n.measured?.height !== undefined
          );
          if (allMeasured) {
            triggerLayout(newNodes, prev.edges);
          }
        } else if (pendingLayoutNodeIdRef.current) {
          const targetChanged = changes.some(
            c => c.type === 'dimensions' && c.id === pendingLayoutNodeIdRef.current
          );
          if (targetChanged) {
            pendingLayoutNodeIdRef.current = null;
            triggerLayout(newNodes, prev.edges);
          }
        }
      }

      return { ...prev, nodes: newNodes };
    });
  }, [triggerLayout]);

  useEffect(() => {
    if (!query.data) return;

    setLayoutResult(prev => {
      const isNewGraph = prev.nodes.length === 0 || !prev.nodes.some(n => query.data.nodes.some(qn => qn.id === n.id));
      const prevNodes = prev.nodes;

      const positions: Record<string, { x: number; y: number }> = {};
      const measured: Record<string, { width?: number; height?: number }> = {};
      prevNodes.forEach(n => {
        positions[n.id] = n.position;
        if (n.measured) measured[n.id] = { width: n.measured.width, height: n.measured.height };
      });

      // Stitch renames
      const newNodeIds = query.data.nodes.map(n => n.id);
      const oldNodeIds = prevNodes.map(n => n.id);
      const addedId = newNodeIds.find(id => !oldNodeIds.includes(id));
      const removedId = oldNodeIds.find(id => !newNodeIds.includes(id));
      if (addedId && removedId) {
        if (positions[removedId]) positions[addedId] = positions[removedId];
        if (measured[removedId]) measured[addedId] = measured[removedId];
      }

      const mapped = fromApiPayload(query.data.nodes, query.data.edges, positions);
      mapped.nodes = mapped.nodes.map(n => measured[n.id] ? { ...n, measured: { ...n.measured, ...measured[n.id] } } : n);

      // Detect slot count changes to schedule layout after React Flow measures new slot dimensions
      const nodeWithCountChange = mapped.nodes.find(node => {
        const prevNode = prevNodes.find(n => n.id === node.id);
        const prevCount = prevNode ? prevNode.data.node.slots.length : 0;
        return prevCount !== node.data.node.slots.length;
      });

      if (nodeWithCountChange) {
        pendingLayoutNodeIdRef.current = nodeWithCountChange.id;
      }

      if (isNewGraph) {
        return { nodes: mapped.nodes, edges: mapped.edges, isLoading: true };
      } else {
        if (!nodeWithCountChange) {
          triggerLayout(mapped.nodes, mapped.edges);
        }
        return { ...prev, nodes: mapped.nodes, edges: mapped.edges };
      }
    });
  }, [query.data, triggerLayout]);

  const selectedNodeId = useGraphStore(state => state.selectedNodeId);
  const selectedSlotId = useGraphStore(state => state.selectedSlotId);

  // Stitch selection states reactively without triggering ELK re-layouts
  const stitchedNodes = useMemo(() => {
    return layoutResult.nodes.map(n => {
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
  }, [layoutResult.nodes, selectedNodeId, selectedSlotId]);

  return {
    ...query,
    nodes: stitchedNodes,
    edges: layoutResult.edges,
    isLoading: layoutResult.isLoading,
    onNodesChange,
  };
};
