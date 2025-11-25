import {
  type Connection,
  Controls,
  type Edge,
  type Node,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useRef } from 'react';
import { api } from '../../../convex-shared/convex/_generated/api';
import type { Id } from '../../../convex-shared/convex/_generated/dataModel';
import { CustomNode } from './ReactFlowMapNode';

type NodeData = { node: { _id: string; offsetX: number; offsetY: number } };
type FlowNode = Node<NodeData>;
type FlowEdge = Edge;

export const ReactFlowMap = ({ mapId }: { mapId: string }) => (
  <div style={{ width: '100vw', height: '100vh' }}>
    <ReactFlowProvider>
      <FlowContent mapId={mapId as Id<'maps'>} />
    </ReactFlowProvider>
  </div>
);

export const FlowContent = ({ mapId }: { mapId: Id<'maps'> }) => {
  const activeMapId: Id<'maps'> = 'j979dj57ksrmzqvd4n83m7d3697w0fxk';

  // Convex data
  const nodesData = useQuery(api.nodes.getNodesOfMap, { mapId: activeMapId });
  const edgesData = useQuery(api.edges.getEdgesOfMap, { mapId: activeMapId });
  const updateNode = useMutation(api.nodes.updateNode);
  const createEdge = useMutation(api.edges.createEdge);
  const deleteEdge = useMutation(api.edges.deleteEdge);

  // React Flow state
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);

  // Prevent updates during drag
  const isDraggingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  // Sync nodes from Convex
  useEffect(() => {
    console.log('happenings');

    if (!nodesData || isDraggingRef.current) return;

    const mappedNodes: FlowNode[] = nodesData.map(n => ({
      id: n._id,
      type: 'custom',
      position: { x: n.offsetX, y: n.offsetY },
      data: { node: n },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }));

    setNodes(mappedNodes);

    // Fit view on initial load
    if (!hasInitializedRef.current && mappedNodes.length > 0) {
      hasInitializedRef.current = true;
      requestAnimationFrame(() => {
        fitView({ padding: 0.1, maxZoom: 1, duration: 0 });
      });
    }
  }, [nodesData, setNodes, fitView]);

  // Sync edges from Convex
  useEffect(() => {
    if (!edgesData || isDraggingRef.current) return;

    const mappedEdges: FlowEdge[] = edgesData.map(e => ({
      id: e._id,
      source: e.fromNodeId,
      target: e.toNodeId,
      animated: false,
    }));

    setEdges(mappedEdges);
  }, [edgesData, setEdges]);

  const handleConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      createEdge({
        mapId: activeMapId,
        fromNodeId: params.source as Id<'nodes'>,
        toNodeId: params.target as Id<'nodes'>,
      });
    },
    [createEdge, activeMapId]
  );

  const handleEdgesDelete = useCallback(
    (edgesToDelete: FlowEdge[]) => {
      edgesToDelete.forEach(edge => {
        deleteEdge({ edgeId: edge.id as Id<'edges'> });
      });
    },
    [deleteEdge]
  );

  const handleNodeDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: FlowNode) => {
      isDraggingRef.current = false;

      updateNode({
        nodeId: node.id as Id<'nodes'>,
        patch: {
          offsetX: Math.round(node.position.x),
          offsetY: Math.round(node.position.y),
        },
      });
    },
    [updateNode]
  );

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      fitView({ padding: 0.1, maxZoom: 1, duration: 300 });
    },
    [fitView]
  );

  if (!nodesData || !edgesData) return null;

  return (
    <ReactFlow<FlowNode, FlowEdge>
      nodeTypes={{ custom: CustomNode }}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={handleConnect}
      onEdgesDelete={handleEdgesDelete}
      onNodeDragStart={handleNodeDragStart}
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
