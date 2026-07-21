import type { NodeChange } from '@xyflow/react';
import { applyNodeChanges } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AppFlowEdge, AppFlowNode } from '../../canvas/types';
import { runLayout } from '../../domain/graph/layout';
import { fromApiPayload } from '../../domain/graph/mappers';
import { useGraphStore } from '../../store/graphStore';
import { useGraphQuery } from './useGraphQuery';


type LayoutResult = {
  nodes: AppFlowNode[];
  edges: AppFlowEdge[];
  isLoading: boolean;
};

// ---------------------------------------------------------------------------
// Private: ELK layout engine
// ---------------------------------------------------------------------------

const INITIAL_LAYOUT: LayoutResult = { nodes: [], edges: [], isLoading: true };

/**
 * Manages the ELK layout lifecycle: sequencing, loading state, and dimension-
 * triggered re-layouts. Exposes stable `schedule` and `reset` callbacks so
 * callers can drive layout without taking on its internal state.
 *
 * Uses a ref-mirrored state pattern: `commit()` updates both the ref and React
 * state atomically, letting callbacks read the current graph without becoming
 * reactive deps or requiring updater functions.
 */
const useLayoutEngine = () => {
  const seqRef = useRef(0);
  const [result, setResult] = useState<LayoutResult>(INITIAL_LAYOUT);

  // Stable mirror of `result` — readable inside callbacks without stale closures.
  const resultRef = useRef<LayoutResult>(INITIAL_LAYOUT);

  const commit = useCallback((next: LayoutResult) => {
    resultRef.current = next;
    setResult(next);
  }, []);

  const schedule = useCallback((nodes: AppFlowNode[], edges: AppFlowEdge[]) => {
    const seq = ++seqRef.current;
    runLayout(nodes, edges).then(laidOut => {
      if (seq !== seqRef.current) return;
      commit({ nodes: laidOut.nodes, edges: laidOut.edges, isLoading: false });
    });
  }, [commit]);

  /** Replace the entire graph and wait for measurements before laying out. */
  const reset = useCallback((nodes: AppFlowNode[], edges: AppFlowEdge[]) => {
    seqRef.current++; // Invalidate any in-flight layout.
    commit({ nodes, edges, isLoading: true });
  }, [commit]);

  /**
   * Commit updated graph data without scheduling ELK. Use when new unmeasured
   * nodes are present — the dimension-change handler will schedule ELK once
   * ReactFlow has measured them, avoiding a wasted run with fallback dimensions.
   */
  const update = useCallback((nodes: AppFlowNode[], edges: AppFlowEdge[]) => {
    commit({ ...resultRef.current, nodes, edges });
  }, [commit]);

  /** Pass to ReactFlow; triggers ELK whenever measured dimensions change. */
  const onNodesLayoutChange = useCallback((changes: NodeChange[]) => {
    const prev = resultRef.current;
    const newNodes = applyNodeChanges(changes, prev.nodes) as AppFlowNode[];

    if (
      changes.some(c => c.type === 'dimensions') &&
      shouldTriggerLayoutOnResize(prev.nodes, newNodes, prev.isLoading)
    ) {
      schedule(newNodes, prev.edges);
    }

    commit({ ...prev, nodes: newNodes });
  }, [schedule, commit]);

  return { result, resultRef, schedule, reset, update, onNodesLayoutChange };
};

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

export const useLaidOutGraph = (graphId: string) => {
  const query = useGraphQuery(graphId);
  const { result, resultRef, schedule, reset, update, onNodesLayoutChange } = useLayoutEngine();

  useEffect(() => {
    if (!query.data) return;

    const prev = resultRef.current;
    const { nodes, edges } = fromApiPayload(
      query.data.nodes,
      query.data.edges,
      prev.nodes,
      prev.edges,
    );

    if (isInitialLoad(prev.nodes)) {
      reset(nodes, edges);
    } else if (nodes.some(n => !prev.nodes.some(pn => pn.id === n.id))) {
      // New nodes have no measured dimensions yet — commit the data and let the
      // dimension-change handler trigger ELK once ReactFlow has measured them.
      update(nodes, edges);
    } else {
      schedule(nodes, edges);
    }
  }, [query.data, reset, schedule, update, resultRef]);

  const selectedNodeId = useGraphStore(state => state.selectedNodeId);
  const selectedSlotId = useGraphStore(state => state.selectedSlotId);

  // Stitch selection states reactively without triggering ELK re-layouts.
  const stitchedNodes = useMemo(
    () => stitchNodeSelection(result.nodes, selectedNodeId, selectedSlotId),
    [result.nodes, selectedNodeId, selectedSlotId],
  );

  return {
    ...query,
    nodes: stitchedNodes,
    edges: result.edges,
    isLoading: result.isLoading,
    onNodesLayoutChange,
  };
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** True on the first data load — prevNodes is empty because FlowContent remounts on graphId change. */
const isInitialLoad = (prevNodes: AppFlowNode[]): boolean => prevNodes.length === 0;

/**
 * Returns true when a resize-triggered re-layout should run.
 *
 * - While loading: wait until every node has been measured.
 * - After loading: trigger only when a node's measured size actually changed.
 */
const shouldTriggerLayoutOnResize = (
  prevNodes: AppFlowNode[],
  newNodes: AppFlowNode[],
  isLoading: boolean,
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
  selectedSlotId: string | null,
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
