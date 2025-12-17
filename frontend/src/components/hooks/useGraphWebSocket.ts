import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryKeys } from '../../api/queryKeys';
import { connectGraphSocket, type GraphEvent } from '../../api/ws';

/**
 * Custom hook to manage WebSocket connection for a graph with react-query integration.
 * Automatically invalidates queries when graph events are received.
 */
export const useGraphWebSocket = (graphId: string | null) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!graphId) return;

    const handleEvent = (event: GraphEvent) => {
      // Invalidate relevant queries based on event type
      switch (event.event) {
        case 'node_created':
        case 'node_updated':
        case 'node_deleted':
          void queryClient.invalidateQueries({ queryKey: queryKeys.nodes.byGraph(event.graph_id) });
          break;
        case 'edge_created':
        case 'edge_deleted':
        case 'edges_updated':
          void queryClient.invalidateQueries({ queryKey: queryKeys.edges.byGraph(event.graph_id) });
          break;
        case 'graph_created':
        case 'graph_updated':
          void queryClient.invalidateQueries({ queryKey: queryKeys.nodes.byGraph(event.graph_id) });
          void queryClient.invalidateQueries({ queryKey: queryKeys.edges.byGraph(event.graph_id) });
          break;
      }
    };

    return connectGraphSocket(graphId, handleEvent);
  }, [graphId, queryClient]);
};

