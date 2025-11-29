import { type Connection, Controls, ReactFlow, useEdgesState, useNodesState, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMutation, useQuery } from 'convex/react';
import * as React from 'react';
import { useEffect } from 'react';
import { api } from '../../../convex/convex/_generated/api';
import type { Id } from '../../../convex/convex/_generated/dataModel';
import { CustomNode } from './FlowNode.tsx';
import type { AppFlowEdge, AppFlowNode } from './types.ts';

export const Flow = () => {
  const activeMapId: Id<'maps'> = 'j972jys6e4qata01jzwmsp2a457wamnd';

  const nodesData = useQuery(api.nodes.getNodesOfMap, { mapId: activeMapId });
  const edgesData = useQuery(api.edges.getEdgesOfMap, { mapId: activeMapId });

  const updateNode = useMutation(api.nodes.updateNode);
  const createEdge = useMutation(api.edges.createEdge);
  const deleteEdge = useMutation(api.edges.deleteEdge);

  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<AppFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AppFlowEdge>([]);

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

    const mappedEdges: AppFlowEdge[] = edgesData.map(e => ({
      id: e._id,
      source: e.fromNodeId,
      target: e.toNodeId,
      sourceHandle: String(e.handleIndex),
      animated: true,
      style: { stroke: '#fff', strokeWidth: 2 },
    }));

    setEdges(mappedEdges);
  }, [edgesData, setEdges]);

  const handleConnect = (params: Connection) => {
    if (!params.source || !params.target) return;
    void createEdge({
      mapId: activeMapId,
      fromNodeId: params.source as Id<'nodes'>,
      toNodeId: params.target as Id<'nodes'>,
      handleIndex: Number(params.sourceHandle),
    });
  };

  const handleEdgesDelete = (edgesToDelete: AppFlowEdge[]) => {
    edgesToDelete.forEach(edge => {
      void deleteEdge({ edgeId: edge.id as Id<'edges'> });
    });
  };

  const handleNodeDragStop = (_event: React.MouseEvent, node: AppFlowNode) => {
    void updateNode({
      nodeId: node.id as Id<'nodes'>,
      patch: {
        offsetX: Math.round(node.position.x),
        offsetY: Math.round(node.position.y),
      },
    });
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    void fitView({ padding: 0.1, maxZoom: 1, duration: 300 });
  };

  if (!nodesData || !edgesData) return null;

  return (
    <ReactFlow<AppFlowNode, AppFlowEdge>
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
    >
      <Controls />
    </ReactFlow>
  );
};
