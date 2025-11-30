import { type Connection, Controls, ReactFlow, useEdgesState, useNodesState, useReactFlow, reconnectEdge, addEdge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { api } from '../../../convex/convex/_generated/api';
import type { Id } from '../../../convex/convex/_generated/dataModel';
import { CustomNode } from './FlowNode.tsx';
import type { AppFlowEdge, AppFlowNode } from './types.ts';

export const Flow = ({ selectedGraphId }: { selectedGraphId: Id<'graphs'> }) => {
  const nodesData = useQuery(api.nodes.getNodesOfGraph, { graphId: selectedGraphId });
  const edgesData = useQuery(api.edges.getEdgesOfGraph, { graphId: selectedGraphId });

  const updateNode = useMutation(api.nodes.updateNode);
  const createEdge = useMutation(api.edges.createEdge);
  const deleteEdge = useMutation(api.edges.deleteEdge);

  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<AppFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AppFlowEdge>([]);

  const edgeReconnectSuccessful = useRef(true);

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  useEffect(() => {
    if (!nodesData) return;
    const mappedNodes: AppFlowNode[] = nodesData.map(n => ({
      id: n._id,
      type: 'custom',
      position: { x: n.offsetX, y: n.offsetY },
      data: { node: n },
    }));
    setNodes(mappedNodes);
  }, [nodesData, setNodes]);

  useEffect(() => {
    if (nodes.length > 0) {
      void fitView({ padding: 0.1, maxZoom: 1, duration: 0 });
    }
  }, [nodes.length, fitView]);

  useEffect(() => {
    if (!edgesData) return;
    const mappedEdges: AppFlowEdge[] = edgesData.map(edge => ({
      id: edge._id,
      source: edge.fromNodeId,
      target: edge.toNodeId,
      sourceHandle: String(edge.handleIndex),
      animated: true,
      style: { stroke: '#fff', strokeWidth: 2 },
    }));
    setEdges(mappedEdges);
  }, [edgesData, setEdges]);

  const handleConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return;

    setEdges((edges) => addEdge(params, edges));

    void createEdge({
      graphId: selectedGraphId,
      fromNodeId: params.source as Id<'nodes'>,
      toNodeId: params.target as Id<'nodes'>,
      handleIndex: Number(params.sourceHandle),
    });
  }, [selectedGraphId, createEdge, setEdges]);

  const handleEdgesDelete = useCallback((edgesToDelete: AppFlowEdge[]) => {
    edgesToDelete.forEach(edge => {
      void deleteEdge({ edgeId: edge.id as Id<'edges'> });
    });
  }, [deleteEdge]);

  const handleReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const handleReconnect = useCallback((oldEdge: AppFlowEdge, newConnection: Connection) => {
    edgeReconnectSuccessful.current = true;

    setEdges((edges) => reconnectEdge(oldEdge, newConnection, edges));

    void deleteEdge({ edgeId: oldEdge.id as Id<'edges'> });

    if (newConnection.source && newConnection.target) {
      void createEdge({
        graphId: selectedGraphId,
        fromNodeId: newConnection.source as Id<'nodes'>,
        toNodeId: newConnection.target as Id<'nodes'>,
        handleIndex: Number(newConnection.sourceHandle),
      });
    }
  }, [selectedGraphId, createEdge, deleteEdge, setEdges]);

  const handleReconnectEnd = useCallback((_event: MouseEvent | TouchEvent, edge: AppFlowEdge) => {
    if (!edgeReconnectSuccessful.current) {
      setEdges((edges) => edges.filter((e) => e.id !== edge.id));
      void deleteEdge({ edgeId: edge.id as Id<'edges'> });
    }

    edgeReconnectSuccessful.current = true;
  }, [deleteEdge, setEdges]);

  const handleNodeDragStop = useCallback((_event: React.MouseEvent, node: AppFlowNode) => {
    void updateNode({
      nodeId: node.id as Id<'nodes'>,
      patch: {
        offsetX: Math.round(node.position.x),
        offsetY: Math.round(node.position.y),
      },
    });
  }, [updateNode]);

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    void fitView({ padding: 0.1, maxZoom: 1, duration: 300 });
  }, [fitView]);

  if (!nodesData || !edgesData) return null;

  return (
    <ReactFlow<AppFlowNode, AppFlowEdge>
      nodeTypes={nodeTypes}
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
