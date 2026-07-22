import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getClientId } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { connectGraphSocket, type GraphEventWithSender } from '../../api/ws';

/**
 * Custom hook to manage WebSocket connection for a graph.
 * Automatically invalidates client cache when graph events are received from other clients.
 */
export const useGraphWebSocket = (graphId: string | null) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!graphId) return;

    const clientId = getClientId();

    const handleEvent = (event: GraphEventWithSender) => {
      if (event.sender_client_id && event.sender_client_id === clientId) return;

      if (event.event === 'graph_updated') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.graphs.flow(event.graph_id) });
      }
    };

    return connectGraphSocket(graphId, handleEvent);
  }, [graphId, queryClient]);
};
