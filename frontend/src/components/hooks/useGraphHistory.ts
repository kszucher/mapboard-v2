import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { components } from '../../api/generated/schema';
import { useSyncGraphFlow } from '../../api/mutations';
import { useGraphFlow } from '../../api/queries';
import { queryKeys } from '../../api/queryKeys';

type GraphFlowRead = components['schemas']['GraphFlowRead'];

export const useGraphHistory = (graphId: string | null) => {
  const queryClient = useQueryClient();
  const { data: graphData } = useGraphFlow(graphId);
  const syncMutation = useSyncGraphFlow();

  const [past, setPast] = useState<GraphFlowRead[]>([]);
  const [future, setFuture] = useState<GraphFlowRead[]>([]);
  const [prevGraphId, setPrevGraphId] = useState<string | null>(graphId);

  // Keep track of the serialized state we last pushed or loaded
  const lastStateRef = useRef<GraphFlowRead | null>(null);

  // Flag to check if the incoming graphData is from an undo/redo trigger
  const isHistoryTransitionRef = useRef(false);

  // Reset history stacks during render if the active graph ID changes
  if (graphId !== prevGraphId) {
    setPrevGraphId(graphId);
    setPast([]);
    setFuture([]);
  }

  // Reset refs in an effect when graph selection changes (outside render)
  useEffect(() => {
    lastStateRef.current = null;
    isHistoryTransitionRef.current = false;
  }, [graphId]);

  // Track incoming query updates
  useEffect(() => {
    if (!graphData) {
      return;
    }

    const serializeFlow = (state: GraphFlowRead) => {
      const sortedNodes = [...state.nodes].sort((a, b) => a.id.localeCompare(b.id));
      const sortedEdges = [...state.edges].sort((a, b) => a.id.localeCompare(b.id));
      const sortedExprs = [...state.expressions].sort((a, b) => a.id.localeCompare(b.id));
      return JSON.stringify({
        nodes: sortedNodes,
        edges: sortedEdges,
        expressions: sortedExprs,
      });
    };

    const isSameState = (s1: GraphFlowRead | null, s2: GraphFlowRead) => {
      if (!s1) return false;
      return serializeFlow(s1) === serializeFlow(s2);
    };

    if (isHistoryTransitionRef.current) {
      isHistoryTransitionRef.current = false;
      lastStateRef.current = JSON.parse(JSON.stringify(graphData));
      return;
    }

    if (isSameState(lastStateRef.current, graphData)) {
      return;
    }

    if (lastStateRef.current) {
      const cloned = JSON.parse(JSON.stringify(lastStateRef.current));
      setPast(prev => [...prev, cloned]);
      setFuture([]); // Clear redo stack on new edit
    }
    lastStateRef.current = JSON.parse(JSON.stringify(graphData));
  }, [graphData]);

  const undo = () => {
    if (past.length === 0 || !graphId || !lastStateRef.current) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);

    const currentClone = JSON.parse(JSON.stringify(lastStateRef.current));
    setFuture(prev => [currentClone, ...prev]);
    setPast(newPast);

    isHistoryTransitionRef.current = true;
    lastStateRef.current = JSON.parse(JSON.stringify(previous));

    queryClient.setQueryData(queryKeys.graphs.flow(graphId), previous);
    syncMutation.mutate({ graphId, payload: previous });
  };

  const redo = () => {
    if (future.length === 0 || !graphId || !lastStateRef.current) return;

    const next = future[0];
    const newFuture = future.slice(1);

    const currentClone = JSON.parse(JSON.stringify(lastStateRef.current));
    setPast(prev => [...prev, currentClone]);
    setFuture(newFuture);

    isHistoryTransitionRef.current = true;
    lastStateRef.current = JSON.parse(JSON.stringify(next));

    queryClient.setQueryData(queryKeys.graphs.flow(graphId), next);
    syncMutation.mutate({ graphId, payload: next });
  };

  return {
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
};
