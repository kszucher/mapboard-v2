import { useQuery } from '@tanstack/react-query';
import type { NodeChange } from '@xyflow/react';
import { applyNodeChanges } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { graphQueries } from '../../api/queries/graphs';
import type { AppFlowEdge, AppFlowNode } from '../../components/types';
import { runLayout } from '../layout';
import { fromApiPayload } from '../mappers';
import { useGraphStore } from '../useGraphStore';

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
      if (hasDimensionsChange) {
        if (prev.isLoading) {
          const allMeasured = newNodes.length > 0 && newNodes.every(
            n => n.measured?.width !== undefined && n.measured?.height !== undefined
          );
          if (allMeasured) {
            triggerLayout(newNodes, prev.edges);
          }
        } else {
          // Detect if any node is newly added or has physically resized
          const anyNodeResized = newNodes.some(node => {
            const prevNode = prev.nodes.find(n => n.id === node.id);
            if (!prevNode) return true; // Newly added node
            return (
              node.measured?.width !== prevNode.measured?.width ||
              node.measured?.height !== prevNode.measured?.height
            );
          });

          if (anyNodeResized) {
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

      const edgeSections: Record<string, any[]> = {};
      prev.edges.forEach(e => {
        if (e.data?.sections) {
          edgeSections[e.id] = e.data.sections;
        }
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
      mapped.nodes = mapped.nodes.map(n => measured[n.id] ? {
        ...n,
        measured: { ...n.measured, ...measured[n.id] }
      } : n);

      // Preserve edge sections to prevent jumping to straight lines
      mapped.edges = mapped.edges.map(e => {
        const prevSections = edgeSections[e.id];
        if (prevSections) {
          return {
            ...e,
            data: {
              ...e.data,
              sections: prevSections,
            }
          };
        }
        return e;
      });

      if (isNewGraph) {
        return { nodes: mapped.nodes, edges: mapped.edges, isLoading: true };
      } else {
        triggerLayout(mapped.nodes, mapped.edges);
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
