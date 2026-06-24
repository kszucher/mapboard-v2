import { type Connection, Controls, type NodeChange, ReactFlow, useReactFlow, } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCreateEdge, useDeleteEdge } from '../api/mutations';
import { useEdges, useExpressions, useNodes } from '../api/queries';
import FlowEdge from './FlowEdge.tsx';
import { CustomNode } from './FlowNode.tsx';
import { useGraphWebSocket } from './hooks/useGraphWebSocket.ts';
import { getLayoutedElements } from './layout.ts';
import type { AppFlowEdge, AppFlowNode, ElkEdgeSection } from './types.ts';

const FlowContent = ({
  selectedGraphId,
}: {
  selectedGraphId: string;
}) => {
  // data fetching
  const { data: nodesData, isFetching: isNodesFetching } = useNodes(selectedGraphId);
  const { data: edgesData, isFetching: isEdgesFetching } = useEdges(selectedGraphId);
  const { data: expressionsData, isFetching: isExpressionsFetching } = useExpressions(selectedGraphId);

  const isSyncBlocked = isNodesFetching || isEdgesFetching || isExpressionsFetching;

  // subscriptions / side effects
  useGraphWebSocket(selectedGraphId);

  // mutations
  const createEdgeMutation = useCreateEdge();
  const deleteEdgeMutation = useDeleteEdge();

  // react-flow / external hooks
  const { fitView } = useReactFlow();

  // local layout & overrides state
  const [nodeState, setNodeState] = useState<Record<string, Partial<AppFlowNode>>>({});
  const [layoutData, setLayoutData] = useState<{
    positions: Record<string, { x: number; y: number }>;
    sections: Record<string, ElkEdgeSection[]>;
    layers: Record<string, number>;
  }>({ positions: {}, sections: {}, layers: {} });

  const isFirstLayoutForGraph = useRef(true);
  const edgeReconnectSuccessful = useRef(true);

  // derived nodes
  const nodes = useMemo<AppFlowNode[]>(() => {
    if (!nodesData) return [];
    return nodesData.map(n => {
      const state = nodeState[n.id] || {};
      const position = layoutData.positions[n.id];

      let tempPosition = position;
      if (!tempPosition) {
        const incomingEdge = edgesData?.find(e => e.to_node_id === n.id);
        const parentNodePosition = incomingEdge ? layoutData.positions[incomingEdge.from_node_id] : null;
        tempPosition = parentNodePosition ? { x: parentNodePosition.x + 300, y: parentNodePosition.y } : { x: 0, y: 0 };
      }

      return {
        id: n.id,
        type: 'custom' as const,
        position: tempPosition,
        data: {
          node: n,
          layer: layoutData.layers[n.id],
        },
        measured: state.measured,
        width: state.width,
        height: state.height,
      };
    });
  }, [nodesData, edgesData, layoutData, nodeState]);

  // derived edges
  const edges = useMemo<AppFlowEdge[]>(() => {
    if (!edgesData || !nodesData || !expressionsData) return [];
    const nodeIds = new Set(nodesData.map(n => n.id));
    const expressionIds = new Set(expressionsData.map(e => e.id));

    return edgesData
      .filter(edge => {
        if (!nodeIds.has(edge.from_node_id) || !nodeIds.has(edge.to_node_id)) return false;
        if (edge.from_expression_id && !expressionIds.has(edge.from_expression_id)) return false;
        return true;
      })
      .map(edge => {
        return {
          id: edge.id,
          source: edge.from_node_id,
          target: edge.to_node_id,
          sourceHandle: edge.from_expression_id ?? String(edge.handle_index),
          type: 'custom' as const,
          animated: true,
          style: { stroke: '#fff', strokeWidth: 2 },
          data: {
            sections: layoutData.sections[edge.id],
          },
        };
      });
  }, [edgesData, nodesData, expressionsData, layoutData.sections]);

  // Render canvas when layout has run or when the graph is empty
  const isLayoutVisible = (nodesData && nodesData.length === 0) || (nodes.length > 0 && nodes.some(n => n.data?.layer !== undefined));

  // memoized values
  const nodeTypes = useMemo(
    () => ({ custom: CustomNode }),
    [],
  );
  const edgeTypes = useMemo(
    () => ({ custom: FlowEdge }),
    [],
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodeState(prev => {
      let hasChanges = false;
      const next = { ...prev };
      changes.forEach(change => {
        if (change.type === 'dimensions' && 'id' in change) {
          const id = change.id;
          const current = next[id] || {};
          if (
            current.measured?.width !== change.dimensions?.width ||
            current.measured?.height !== change.dimensions?.height
          ) {
            hasChanges = true;
            next[id] = {
              ...current,
              measured: change.dimensions,
              width: change.dimensions?.width,
              height: change.dimensions?.height,
            };
          }
        }
      });
      return hasChanges ? next : prev;
    });
  }, []);

  const onEdgesChange = useCallback(() => {
  }, []);

  const handleConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

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
    [selectedGraphId, createEdgeMutation],
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
    [selectedGraphId, createEdgeMutation, deleteEdgeMutation],
  );

  const handleReconnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, edge: AppFlowEdge) => {
      if (!edgeReconnectSuccessful.current) {
        deleteEdgeMutation.mutate({ edgeId: edge.id as string });
      }
      edgeReconnectSuccessful.current = true;
    },
    [deleteEdgeMutation],
  );

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      void fitView({ padding: 0.1, maxZoom: 1, duration: 300 });
    },
    [fitView],
  );

  // Run layout when nodes are fully initialized/measured and graph structure changes
  const lastLayoutedKey = useRef<string>('');
  useEffect(() => {
    if (isSyncBlocked || !nodesData || nodes.length === 0) return;

    // Check if we have dimensions for all nodes that are currently in nodesData
    const allNodesMeasured = nodes.every(n => n.measured !== undefined);
    if (!allNodesMeasured) return;

    const expressionsKey = expressionsData
      ? [...expressionsData]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(e => `${e.id}:${e.idx}`)
        .join(',')
      : '';

    const currentKey = `${nodes.map(n => n.id).sort().join(',')}|${edges.map(e => e.id).sort().join(',')}|${expressionsKey}`;

    if (currentKey !== lastLayoutedKey.current) {
      lastLayoutedKey.current = currentKey;

      const runLayout = async () => {
        try {
          const {
            nodes: layoutedNodes,
            edges: layoutedEdges
          } = await getLayoutedElements(nodes, edges, expressionsData);

          const nextPositions: Record<string, { x: number; y: number }> = {};
          const nextLayers: Record<string, number> = {};
          layoutedNodes.forEach(n => {
            nextPositions[n.id] = n.position;
            nextLayers[n.id] = n.data?.layer ?? 0;
          });

          const nextSections: Record<string, ElkEdgeSection[]> = {};
          layoutedEdges.forEach(e => {
            if (e.data?.sections) {
              nextSections[e.id] = e.data.sections;
            }
          });

          setLayoutData({
            positions: nextPositions,
            sections: nextSections,
            layers: nextLayers,
          });

          // Fit view nicely if it is the first layout of a newly loaded graph
          if (isFirstLayoutForGraph.current) {
            isFirstLayoutForGraph.current = false;
            void fitView({ padding: 0.1, duration: 0 });
          }
        } catch (error) {
          console.error('Failed to auto-layout nodes:', error);
        }
      };

      void runLayout();
    }
  }, [nodes, edges, expressionsData, isSyncBlocked, nodesData, fitView]);

  if (!nodesData || !edgesData || !expressionsData) return null;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        opacity: isLayoutVisible ? 1 : 0,
        transition: 'opacity 0.2s ease-in-out'
      }}>
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
        nodesDraggable={false}
        onDoubleClick={handleDoubleClick}
        colorMode="dark"
        zoomOnScroll={true}
        zoomOnDoubleClick={false}
        panOnScroll={false}
      >
        <Controls/>
      </ReactFlow>
    </div>
  );
};

export const Flow = ({ selectedGraphId }: { selectedGraphId: string }) => {
  return (
    <FlowContent key={selectedGraphId} selectedGraphId={selectedGraphId}/>
  );
};
