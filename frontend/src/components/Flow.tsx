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
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useCreateEdge, useDeleteEdge, useUpdateNodePosition, useUpdateNodesPositions } from '../api/mutations';
import { useEdges, useExpressions, useNodes } from '../api/queries';
import FlowEdge from './FlowEdge.tsx';
import { CustomNode } from './FlowNode.tsx';
import { useGraphWebSocket } from './hooks/useGraphWebSocket.ts';
import { getLayoutedElements } from './layout.ts';
import type { AppFlowEdge, AppFlowNode } from './types.ts';

export interface FlowRef {
  triggerLayout: () => Promise<void>;
}

const FlowContent = ({
                       selectedGraphId,
                       flowRef,
                     }: {
  selectedGraphId: string;
  flowRef: React.RefObject<FlowRef | null>;
}) => {
  // data fetching
  const { data: nodesData } = useNodes(selectedGraphId);
  const { data: edgesData } = useEdges(selectedGraphId);
  const { data: expressionsData } = useExpressions(selectedGraphId);

  // subscriptions / side effects
  useGraphWebSocket(selectedGraphId);

  // mutations
  const updateNodePositionMutation = useUpdateNodePosition();
  const updateNodesPositionsMutation = useUpdateNodesPositions();
  const createEdgeMutation = useCreateEdge();
  const deleteEdgeMutation = useDeleteEdge();

  // react-flow / external hooks
  const { fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();

  // local state
  const [nodes, setNodes, onNodesChange] =
    useNodesState<AppFlowNode>([]);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<AppFlowEdge>([]);

  // refs
  const prevGraphId = useRef<string | null>(null);
  const edgeReconnectSuccessful = useRef(true);
  const edgeSectionsRef = useRef<Record<string, any[]>>({});

  // Clear edge layout sections when changing graphs
  useEffect(() => {
    edgeSectionsRef.current = {};
  }, [selectedGraphId]);

  // memoized values
  const nodeTypes = useMemo(
    () => ({ custom: CustomNode }),
    [],
  );
  const edgeTypes = useMemo(
    () => ({ custom: FlowEdge }),
    [],
  );

  const mappedEdges = useMemo<AppFlowEdge[]>(() => {
    if (!edgesData || !nodesData || !expressionsData) return [];

    const nodeIds = new Set(nodesData.map(n => n.id));
    const expressionIds = new Set(expressionsData.map(e => e.id));

    return edgesData
      .filter(edge => {
        // Ensure source and target nodes exist
        if (!nodeIds.has(edge.from_node_id) || !nodeIds.has(edge.to_node_id)) {
          return false;
        }
        // Ensure source expression exists if it's a hard link
        if (edge.from_expression_id && !expressionIds.has(edge.from_expression_id)) {
          return false;
        }
        return true;
      })
      .map(edge => ({
        id: edge.id,
        source: edge.from_node_id,
        target: edge.to_node_id,
        sourceHandle: edge.from_expression_id ?? String(edge.handle_index),
        type: 'custom' as const,
        animated: true,
        style: { stroke: '#fff', strokeWidth: 2 },
        data: {
          sections: edgeSectionsRef.current[edge.id],
        },
      }));
  }, [edgesData, nodesData, expressionsData]);

  // Sync nodes from query data to state, preserving local state (measured dimensions, etc.)
  useEffect(() => {
    if (!nodesData) return;

    setNodes(prevNodes => {
      const nodeMap = new Map(prevNodes.map(n => [n.id, n]));
      return nodesData.map(n => {
        const prevNode = nodeMap.get(n.id);
        const position = prevNode?.dragging
          ? prevNode.position
          : { x: n.offset_x, y: n.offset_y };

        return {
          id: n.id,
          type: 'custom' as const,
          position,
          data: { node: n },
          // Preserve measured dimensions and other localized state
          measured: prevNode?.measured,
          width: prevNode?.width,
          height: prevNode?.height,
          dragging: prevNode?.dragging,
        };
      });
    });
  }, [nodesData, setNodes]);

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

      const sourceHandle = params.sourceHandle;
      const isExpressionId = !!sourceHandle && sourceHandle.length > 5;

      createEdgeMutation.mutate({
        graphId: selectedGraphId,
        fromNodeId: params.source as string,
        toNodeId: params.target as string,
        handleIndex: isExpressionId ? 0 : (Number(sourceHandle) || 0),
        fromExpressionId: isExpressionId ? (sourceHandle as string) : undefined,
      });
    },
    [selectedGraphId, createEdgeMutation, setEdges],
  );

  const handleEdgesDelete = useCallback(
    (edgesToDelete: AppFlowEdge[]) => {
      edgesToDelete.forEach(edge => {
        deleteEdgeMutation.mutate({ edgeId: edge.id as string });
      });
    },
    [deleteEdgeMutation],
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
        const sourceHandle = newConnection.sourceHandle;
        const isExpressionId = !!sourceHandle && sourceHandle.length > 5;

        createEdgeMutation.mutate({
          graphId: selectedGraphId,
          fromNodeId: newConnection.source as string,
          toNodeId: newConnection.target as string,
          handleIndex: isExpressionId ? 0 : (Number(sourceHandle) || 0),
          fromExpressionId: isExpressionId ? (sourceHandle as string) : undefined,
        });
      }
    },
    [selectedGraphId, createEdgeMutation, deleteEdgeMutation, setEdges],
  );

  const handleReconnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, edge: AppFlowEdge) => {
      if (!edgeReconnectSuccessful.current) {
        setEdges(edges => edges.filter(e => e.id !== edge.id));
        deleteEdgeMutation.mutate({ edgeId: edge.id as string });
      }

      edgeReconnectSuccessful.current = true;
    },
    [deleteEdgeMutation, setEdges],
  );

  const handleNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: AppFlowNode) => {
      updateNodePositionMutation.mutate({
        nodeId: node.id as string,
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
        graphId: selectedGraphId,
      });
    },
    [selectedGraphId, updateNodePositionMutation],
  );

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      void fitView({ padding: 0.1, maxZoom: 1, duration: 300 });
    },
    [fitView],
  );

  const performLayout = useCallback(async () => {
    if (nodes.length === 0) return;

    try {
      const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(nodes, edges, expressionsData);

      // Store the layouted edge sections in ref so they are preserved on sync
      const sectionsMap: Record<string, any[]> = {};
      layoutedEdges.forEach(e => {
        if (e.data?.sections) {
          sectionsMap[e.id] = e.data.sections;
        }
      });
      edgeSectionsRef.current = sectionsMap;

      // Update local nodes and edges state immediately for visual response
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

      // Prepare bulk update payload
      const offsets = layoutedNodes.map((node) => ({
        id: node.id,
        offset_x: Math.round(node.position.x),
        offset_y: Math.round(node.position.y),
      }));

      // Persist to database
      await updateNodesPositionsMutation.mutateAsync({
        offsets,
        graphId: selectedGraphId,
      });

      // Fit view nicely after layout
      void fitView({ padding: 0.1, duration: 300 });
    } catch (error) {
      console.error('Failed to auto-layout nodes:', error);
    }
  }, [nodes, edges, expressionsData, selectedGraphId, setNodes, setEdges, updateNodesPositionsMutation, fitView]);

  useImperativeHandle(flowRef, () => ({
    triggerLayout: performLayout,
  }));

  if (!nodesData || !edgesData || !expressionsData) return null;

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
      zoomOnScroll={true}
      zoomOnDoubleClick={false}
      panOnScroll={false}
    >
      <Controls/>
    </ReactFlow>
  );
};

export const Flow = forwardRef<FlowRef, { selectedGraphId: string }>(
  ({ selectedGraphId }, ref) => {
    const flowContentRef = useRef<FlowRef | null>(null);

    useImperativeHandle(ref, () => ({
      triggerLayout: async () => {
        await flowContentRef.current?.triggerLayout();
      },
    }));

    return (
      <FlowContent selectedGraphId={selectedGraphId} flowRef={flowContentRef}/>
    );
  }
);
