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
import type { Id } from '../../../convex/convex/_generated/dataModel';
import { GraphMutationsProvider, useGraphMutationsContext } from './contexts/GraphMutationsContext.tsx';
import FlowEdge from './FlowEdge.tsx';
import { CustomNode } from './FlowNode.tsx';
import type { AppFlowEdge, AppFlowNode } from './types.ts';
import { useGraphQueries } from './useGraphQueries.ts';

const FlowContent = ({ selectedGraphId }: { selectedGraphId: Id<'graphs'> }) => {
  const { nodes: nodesData, edges: edgesData } = useGraphQueries(selectedGraphId);

  const { updateNodePosition, createEdge, deleteEdge } = useGraphMutationsContext();

  const { fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const [nodes, setNodes, onNodesChange] = useNodesState<AppFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AppFlowEdge>([]);

  const prevGraphId = useRef<Id<'graphs'> | null>(null);
  const edgeReconnectSuccessful = useRef(true);

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);
  const edgeTypes = useMemo(() => ({ custom: FlowEdge }), []);

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
    if (
      nodesInitialized &&
      nodes.length > 0 &&
      nodes[0].data.node.graphId === selectedGraphId &&
      prevGraphId.current !== selectedGraphId
    ) {
      prevGraphId.current = selectedGraphId;
      void fitView({ padding: 0.1, maxZoom: 1, duration: 0 });
    }
  }, [nodesInitialized, nodes, fitView, selectedGraphId]);

  useEffect(() => {
    if (!edgesData) return;
    const mappedEdges: AppFlowEdge[] = edgesData.map(edge => ({
      id: edge._id,
      source: edge.fromNodeId,
      target: edge.toNodeId,
      sourceHandle: String(edge.handleIndex),
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
        params.source as Id<'nodes'>,
        params.target as Id<'nodes'>,
        Number(params.sourceHandle)
      );
    },
    [selectedGraphId, createEdge, setEdges]
  );

  const handleEdgesDelete = useCallback(
    (edgesToDelete: AppFlowEdge[]) => {
      edgesToDelete.forEach(edge => {
        deleteEdge(edge.id as Id<'edges'>);
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

      deleteEdge(oldEdge.id as Id<'edges'>);

      if (newConnection.source && newConnection.target) {
        createEdge(
          selectedGraphId,
          newConnection.source as Id<'nodes'>,
          newConnection.target as Id<'nodes'>,
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
        deleteEdge(edge.id as Id<'edges'>);
      }

      edgeReconnectSuccessful.current = true;
    },
    [deleteEdge, setEdges]
  );

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: AppFlowNode) => {
      updateNodePosition(node.id as Id<'nodes'>, Math.round(node.position.x), Math.round(node.position.y));
    },
    [updateNodePosition]
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

export const Flow = ({ selectedGraphId }: { selectedGraphId: Id<'graphs'> }) => {
  return (
    <GraphMutationsProvider>
      <FlowContent selectedGraphId={selectedGraphId} />
    </GraphMutationsProvider>
  );
};
