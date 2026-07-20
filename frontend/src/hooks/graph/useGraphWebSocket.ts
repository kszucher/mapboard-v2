import { useEffect } from 'react';
import { getClientId } from '../../api/client';
import { connectGraphSocket, type GraphEventWithSender } from '../../api/ws';
import { useGraphStore } from '../../store/graphStore';

/**
 * Custom hook to manage WebSocket connection for a graph with Zustand store integration.
 * Automatically refreshes the Zustand store when graph events are received from other clients.
 */
export const useGraphWebSocket = (graphId: string | null) => {
  useEffect(() => {
    if (!graphId) return;

    const clientId = getClientId();

    const handleEvent = (event: GraphEventWithSender) => {
      if (event.sender_client_id && event.sender_client_id === clientId) return;

      if (event.event === 'graph_updated') {
        void useGraphStore.getState().init(event.graph_id);
      }
    };

    return connectGraphSocket(graphId, handleEvent);
  }, [graphId]);
};
