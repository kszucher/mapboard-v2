import { useQueryClient } from '@tanstack/react-query';
import {
  addEdge,
  type Connection,
  Controls,
  ReactFlow,
  reconnectEdge,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { connectGraphSocket } from '../api/ws';
import { GraphMutationsProvider, useGraphMutationsContext } from './contexts/GraphMutationsContext.tsx';
import FlowEdge from './FlowEdge.tsx';
import { CustomNode } from './FlowNode.tsx';
import type { AppFlowEdge, AppFlowNode } from './types.ts';
import { useGraphQueries } from './useGraphQueries.ts';

const FlowContent = ({ selectedGraphId }: { selectedGraphId: string }) => {
  const queryClient = useQueryClient();
  const { nodes: nodesData, edges: edgesData } = useGraphQueries(selectedGraphId);

  const { updateNodePosition, createEdge, deleteEdge } = useGraphMutationsContext();

  const { fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const [nodes, setNodes, onNodesChange] = useNodesState<AppFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AppFlowEdge>([]);

  const prevGraphId = useRef<string | null>(null);
  const edgeReconnectSuccessful = useRef(true);

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);
  const edgeTypes = useMemo(() => ({ custom: FlowEdge }), []);

  useEffect(() => {
    if (!selectedGraphId) return;

    const disconnect = connectGraphSocket(selectedGraphId, event => {
      void queryClient.invalidateQueries({ queryKey: ['nodes', selectedGraphId] });
      void queryClient.invalidateQueries({ queryKey: ['edges', selectedGraphId] });
    });

    return disconnect;
  }, [queryClient, selectedGraphId]);

  useEffect(() => {
    if (!nodesData) return;
    setNodes(prevNodes => {
      const nodeMap = new Map(prevNodes.map(n => [n.id, n]));
      return nodesData.map(n => {
        const prevNode = nodeMap.get(n.id);
        return {
          id: n.id,
          type: 'custom',
          position: { x: n.offset_x, y: n.offset_y },
          data: { node: n },
          // Preserve measured dimensions and other localized state
          measured: prevNode?.measured,
          width: prevNode?.width,
          height: prevNode?.height,
        };
      });
    });
  }, [nodesData, setNodes]);

  useEffect(() => {
    if (
      nodesInitialized &&
      nodes.length > 0 &&
      nodes[0].data.node.graph_id === selectedGraphId &&
      prevGraphId.current !== selectedGraphId
    ) {
      prevGraphId.current = selectedGraphId;
      void fitView({ padding: 0.1, maxZoom: 1, duration: 0 });
    }
  }, [nodesInitialized, nodes, fitView, selectedGraphId]);

  useEffect(() => {
    if (!edgesData) return;
    const mappedEdges: AppFlowEdge[] = edgesData.map(edge => ({
      id: edge.id,
      source: edge.from_node_id,
      target: edge.to_node_id,
      sourceHandle: String(edge.handle_index),
      type: 'custom',
      animated: true,
      style: { stroke: '#fff', strokeWidth: 2 },
    }));
    setEdges(mappedEdges);
  }, [edgesData, setEdges]);

  const handleConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      setEdges(edges => addEdge(params, edges));

      createEdge(
        selectedGraphId,
        params.source as string,
        params.target as string,
        Number(params.sourceHandle)
      );
    },
    [selectedGraphId, createEdge, setEdges]
  );

  const handleEdgesDelete = useCallback(
    (edgesToDelete: AppFlowEdge[]) => {
      edgesToDelete.forEach(edge => {
        deleteEdge(edge.id as string);
      });
    },
    [deleteEdge]
  );

  const handleReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const handleReconnect = useCallback(
    (oldEdge: AppFlowEdge, newConnection: Connection) => {
      edgeReconnectSuccessful.current = true;

      setEdges(edges => reconnectEdge(oldEdge, newConnection, edges));

      deleteEdge(oldEdge.id as string);

      if (newConnection.source && newConnection.target) {
        createEdge(
          selectedGraphId,
          newConnection.source as string,
          newConnection.target as string,
          Number(newConnection.sourceHandle)
        );
      }
    },
    [selectedGraphId, createEdge, deleteEdge, setEdges]
  );

  const handleReconnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, edge: AppFlowEdge) => {
      if (!edgeReconnectSuccessful.current) {
        setEdges(edges => edges.filter(e => e.id !== edge.id));
        deleteEdge(edge.id as string);
      }

      edgeReconnectSuccessful.current = true;
    },
    [deleteEdge, setEdges]
  );

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: AppFlowNode) => {
      updateNodePosition(node.id as string, Math.round(node.position.x), Math.round(node.position.y), selectedGraphId);
    },
    [selectedGraphId, updateNodePosition]
  );

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      void fitView({ padding: 0.1, maxZoom: 1, duration: 300 });
    },
    [fitView]
  );

  if (!nodesData || !edgesData) return null;

  return (
    <ReactFlow<AppFlowNode, AppFlowEdge>
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={handleConnect}
      onEdgesDelete={handleEdgesDelete}
      onReconnect={handleReconnect}
      onReconnectStart={handleReconnectStart}
      onReconnectEnd={handleReconnectEnd}
      onNodeDragStop={handleNodeDragStop}
      onDoubleClick={handleDoubleClick}
      colorMode="dark"
      zoomOnScroll={false}
      zoomOnDoubleClick={false}
      panOnScroll
    >
      <Controls />
    </ReactFlow>
  );
};

export const Flow = ({ selectedGraphId }: { selectedGraphId: string }) => {
  return (
    <GraphMutationsProvider>
      <FlowContent selectedGraphId={selectedGraphId} />
    </GraphMutationsProvider>
  );
};
