import { wsBaseUrl } from './client';

export type GraphEvent =
  | { event: 'graph_created'; graph_id: string; payload: Record<string, unknown> }
  | { event: 'graph_updated'; graph_id: string; payload: Record<string, unknown> }
  | { event: 'node_created'; graph_id: string; payload: Record<string, unknown> }
  | { event: 'node_updated'; graph_id: string; payload: Record<string, unknown> }
  | { event: 'node_deleted'; graph_id: string; payload: Record<string, unknown> }
  | { event: 'edge_created'; graph_id: string; payload: Record<string, unknown> }
  | { event: 'edge_deleted'; graph_id: string; payload: Record<string, unknown> }
  | { event: 'edges_updated'; graph_id: string; payload: Record<string, unknown> };

export const connectGraphSocket = (graphId: string, onEvent: (event: GraphEvent) => void): (() => void) => {
  const socket = new WebSocket(`${wsBaseUrl}/ws/graphs/${graphId}`);

  socket.onmessage = evt => {
    try {
      const data = JSON.parse(evt.data) as GraphEvent;
      onEvent(data);
    } catch (err) {
      console.warn('Invalid WS payload', err);
    }
  };

  const cleanup = () => {
    socket.close();
  };

  return cleanup;
};


