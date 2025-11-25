import {
  type Connection,
  Controls,
  type Edge,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMutation, useQuery } from 'convex/react';
import { useEffect } from 'react';
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

  // Sync nodes from Convex
  useEffect(() => {
    if (!nodesData) return;

    const mappedNodes: FlowNode[] = nodesData.map(n => ({
      id: n._id,
      type: 'custom',
      position: { x: n.offsetX, y: n.offsetY },
      data: { node: n },
    }));

    setNodes(mappedNodes);
  }, [nodesData, setNodes]);

  // Fit view on initial load
  useEffect(() => {
    if (nodes.length > 0) {
      requestAnimationFrame(() => {
        fitView({ padding: 0.1, maxZoom: 1, duration: 0 });
      });
    }
  }, [nodes.length, fitView]);

  // Sync edges from Convex
  useEffect(() => {
    if (!edgesData) return;

    const mappedEdges: FlowEdge[] = edgesData.map(e => ({
      id: e._id,
      source: e.fromNodeId,
      target: e.toNodeId,
      animated: true,
      style: { stroke: '#fff', strokeWidth: 2 },
    }));

    setEdges(mappedEdges);
  }, [edgesData, setEdges]);

  const handleConnect = (params: Connection) => {
    if (!params.source || !params.target) return;

    // Persist to Convex (edges will appear when Convex data updates)
    createEdge({
      mapId: activeMapId,
      fromNodeId: params.source as Id<'nodes'>,
      toNodeId: params.target as Id<'nodes'>,
    });
  };

  const handleEdgesDelete = (edgesToDelete: FlowEdge[]) => {
    edgesToDelete.forEach(edge => {
      deleteEdge({ edgeId: edge.id as Id<'edges'> });
    });
  };

  const handleNodeDragStop = (_event: React.MouseEvent, node: FlowNode) => {
    updateNode({
      nodeId: node.id as Id<'nodes'>,
      patch: {
        offsetX: Math.round(node.position.x),
        offsetY: Math.round(node.position.y),
      },
    });
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    fitView({ padding: 0.1, maxZoom: 1, duration: 300 });
  };

  if (!nodesData || !edgesData) return null;

  return (
    <ReactFlow<FlowNode, FlowEdge>
      nodeTypes={{ custom: CustomNode }}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={handleConnect}
      onEdgesDelete={handleEdgesDelete} // already here
      onNodeDragStop={handleNodeDragStop}
      onDoubleClick={handleDoubleClick}
      colorMode="dark"
      zoomOnScroll={false}
      zoomOnDoubleClick={false}
      panOnScroll
      deleteKeyCode={46} // 46 = Delete key
    >
      <Controls />
    </ReactFlow>

  );
};
