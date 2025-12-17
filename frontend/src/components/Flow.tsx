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
import { useCreateEdge, useDeleteEdge, useUpdateNodePosition } from '../api/mutations';
import { useEdges, useNodes } from '../api/queries';
import FlowEdge from './FlowEdge.tsx';
import { CustomNode } from './FlowNode.tsx';
import { useGraphWebSocket } from './hooks/useGraphWebSocket.ts';
import type { AppFlowEdge, AppFlowNode } from './types.ts';

const FlowContent = ({ selectedGraphId }: { selectedGraphId: string }) => {
  const { data: nodesData } = useNodes(selectedGraphId);
  const { data: edgesData } = useEdges(selectedGraphId);
  useGraphWebSocket(selectedGraphId);

  const updateNodePositionMutation = useUpdateNodePosition();
  const createEdgeMutation = useCreateEdge();
  const deleteEdgeMutation = useDeleteEdge();

  const { fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const [nodes, setNodes, onNodesChange] = useNodesState<AppFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AppFlowEdge>([]);

  const prevGraphId = useRef<string | null>(null);
  const edgeReconnectSuccessful = useRef(true);

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);
  const edgeTypes = useMemo(() => ({ custom: FlowEdge }), []);

  // Sync nodes from query data to state, preserving local state (measured dimensions, etc.)
  useEffect(() => {
    if (!nodesData) return;
    
    setNodes(prevNodes => {
      const nodeMap = new Map(prevNodes.map(n => [n.id, n]));
      return nodesData.map(n => {
        const prevNode = nodeMap.get(n.id);
        return {
          id: n.id,
          type: 'custom' as const,
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

  // Map edges from query data to ReactFlow format
  const mappedEdges = useMemo<AppFlowEdge[]>(() => {
    if (!edgesData) return [];
    return edgesData.map(edge => ({
      id: edge.id,
      source: edge.from_node_id,
      target: edge.to_node_id,
      sourceHandle: String(edge.handle_index),
      type: 'custom' as const,
      animated: true,
      style: { stroke: '#fff', strokeWidth: 2 },
    }));
  }, [edgesData]);

  // Sync edges from query data to state
  useEffect(() => {
    setEdges(mappedEdges);
  }, [mappedEdges, setEdges]);

  // Fit view when graph changes (minimized useEffect)
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

  const handleConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      setEdges(edges => addEdge(params, edges));

      createEdgeMutation.mutate({
        graphId: selectedGraphId,
        fromNodeId: params.source as string,
        toNodeId: params.target as string,
        handleIndex: Number(params.sourceHandle),
      });
    },
    [selectedGraphId, createEdgeMutation, setEdges]
  );

  const handleEdgesDelete = useCallback(
    (edgesToDelete: AppFlowEdge[]) => {
      edgesToDelete.forEach(edge => {
        deleteEdgeMutation.mutate({ edgeId: edge.id as string });
      });
    },
    [deleteEdgeMutation]
  );

  const handleReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const handleReconnect = useCallback(
    (oldEdge: AppFlowEdge, newConnection: Connection) => {
      edgeReconnectSuccessful.current = true;

      setEdges(edges => reconnectEdge(oldEdge, newConnection, edges));

      deleteEdgeMutation.mutate({ edgeId: oldEdge.id as string });

      if (newConnection.source && newConnection.target) {
        createEdgeMutation.mutate({
          graphId: selectedGraphId,
          fromNodeId: newConnection.source as string,
          toNodeId: newConnection.target as string,
          handleIndex: Number(newConnection.sourceHandle),
        });
      }
    },
    [selectedGraphId, createEdgeMutation, deleteEdgeMutation, setEdges]
  );

  const handleReconnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, edge: AppFlowEdge) => {
      if (!edgeReconnectSuccessful.current) {
        setEdges(edges => edges.filter(e => e.id !== edge.id));
        deleteEdgeMutation.mutate({ edgeId: edge.id as string });
      }

      edgeReconnectSuccessful.current = true;
    },
    [deleteEdgeMutation, setEdges]
  );

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: AppFlowNode) => {
      updateNodePositionMutation.mutate(
        node.id as string,
        Math.round(node.position.x),
        Math.round(node.position.y),
        selectedGraphId
      );
    },
    [selectedGraphId, updateNodePositionMutation]
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
  return <FlowContent selectedGraphId={selectedGraphId} />;
};
