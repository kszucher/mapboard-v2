import {
  type Connection,
  Controls,
  type NodeChange,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useCreateEdge, useDeleteEdge } from '../api/mutations';
import { useGraphFlow } from '../api/queries';
import FlowEdge from './FlowEdge.tsx';
import { CustomNode } from './FlowNode.tsx';
import { useGraphWebSocket } from './hooks/useGraphWebSocket.ts';
import { getLayoutedElements } from './layout.ts';
import type { AppFlowEdge, AppFlowNode } from './types.ts';

/** UUID v4 regex — distinguishes expression handle IDs (UUIDs) from numeric handle indices */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isExpressionHandle = (handle: string | null | undefined): handle is string =>
  handle != null && UUID_RE.test(handle);

const FlowContent = ({
  selectedGraphId,
}: {
  selectedGraphId: string;
}) => {
  // data fetching
  const { data: graphData, isFetching } = useGraphFlow(selectedGraphId);

  // subscriptions / side effects
  useGraphWebSocket(selectedGraphId);

  // mutations — extract stable .mutate refs to avoid recreating callbacks every render
  // (useMutation returns a new object reference each render in TanStack Query v5)
  const createEdgeMutation = useCreateEdge();
  const deleteEdgeMutation = useDeleteEdge();
  const createEdge = createEdgeMutation.mutate;
  const deleteEdge = deleteEdgeMutation.mutate;

  // react-flow / external hooks
  const { fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();

  // local layout & overrides state
  const [nodeState, setNodeState] = useState<Record<string, Partial<AppFlowNode>>>({});
  const [layoutData, setLayoutData] = useState<{
    positions: Record<string, { x: number; y: number }>;
    layers: Record<string, number>;
  }>({ positions: {}, layers: {} });

  const [isReady, setIsReady] = useState(false);
  const edgeReconnectSuccessful = useRef(true);
  // Always reflects the latest rendered nodes/edges without putting them in effect deps
  const layoutInputRef = useRef({ nodes: [] as AppFlowNode[], edges: [] as AppFlowEdge[] });

  // derived nodes
  const nodes = useMemo<AppFlowNode[]>(() => {
    if (!graphData) return [];
    return graphData.nodes.map(n => {
      const state = nodeState[n.id] || {};
      const position = layoutData.positions[n.id];

      let tempPosition = position;
      if (!tempPosition) {
        const incomingEdge = graphData.edges?.find(e => e.to_node_id === n.id);
        const parentNodePosition = incomingEdge ? layoutData.positions[incomingEdge.from_node_id] : null;
        tempPosition = parentNodePosition ? { x: parentNodePosition.x + 300, y: parentNodePosition.y } : { x: 0, y: 0 };
      }

      const nodeExpressions = graphData.expressions.filter(e => e.node_id === n.id);

      return {
        id: n.id,
        type: 'custom' as const,
        position: tempPosition,
        data: {
          node: n,
          layer: layoutData.layers[n.id],
          expressions: nodeExpressions,
        },
        measured: state.measured,
      };
    });
  }, [graphData, layoutData, nodeState]);

  // derived edges — uses layoutData.layers directly (O(1) lookup) to avoid depending on the nodes array
  const edges = useMemo<AppFlowEdge[]>(() => {
    if (!graphData) return [];
    const nodeIds = new Set(graphData.nodes.map(n => n.id));
    const expressionIds = new Set(graphData.expressions.map(e => e.id));

    return graphData.edges
      .filter(edge => {
        if (!nodeIds.has(edge.from_node_id) || !nodeIds.has(edge.to_node_id)) return false;
        if (edge.from_expression_id && !expressionIds.has(edge.from_expression_id)) return false;
        return true;
      })
      .map(edge => {
        const sourceLayer = layoutData.layers[edge.from_node_id];
        const targetLayer = layoutData.layers[edge.to_node_id];
        const isBack = sourceLayer !== undefined && targetLayer !== undefined && sourceLayer >= targetLayer;
        const isLayoutReady = sourceLayer !== undefined && targetLayer !== undefined;

        return {
          id: edge.id,
          source: edge.from_node_id,
          target: edge.to_node_id,
          sourceHandle: edge.from_expression_id ?? String(edge.handle_index),
          type: 'custom' as const,
          animated: true,
          style: {
            stroke: '#fff',
            strokeWidth: 2,
            opacity: isLayoutReady ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out',
          },
          deletable: isBack,
          reconnectable: isBack,
        };
      });
  }, [graphData, layoutData.layers]);

  // Keep ref current before any effects fire so the layout effect always reads the latest values
  useLayoutEffect(() => {
    layoutInputRef.current = { nodes, edges };
  });

  // Fit view once on initial load — isReady resets to false on remount (key={selectedGraphId})
  useEffect(() => {
    if (isReady) return;
    const hasLayout = nodes.length > 0 && nodes.every(n => layoutData.positions[n.id] !== undefined);
    if (!hasLayout || !nodesInitialized) return;
    void fitView({ padding: 0.1, duration: 0 }).then(success => {
      if (success) setIsReady(true);
    });
  }, [layoutData.positions, nodes, isReady, nodesInitialized, fitView]);

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

  // Uses layoutData.layers directly (O(1) lookup) instead of scanning the nodes array
  const isValidConnection = useCallback(
    (connection: Connection | AppFlowEdge) => {
      if (!connection.source || !connection.target) return false;
      const sourceLayer = layoutData.layers[connection.source];
      const targetLayer = layoutData.layers[connection.target];
      return sourceLayer !== undefined && targetLayer !== undefined && sourceLayer >= targetLayer;
    },
    [layoutData.layers],
  );

  // Shared helper — handles both new connections and reconnects
  const createEdgeFromConnection = useCallback(
    (connection: Pick<Connection, 'source' | 'target' | 'sourceHandle'>) => {
      if (!connection.source || !connection.target) return;
      const { sourceHandle } = connection;
      createEdge({
        edgeId: crypto.randomUUID(),
        graphId: selectedGraphId,
        fromNodeId: connection.source,
        toNodeId: connection.target,
        handleIndex: isExpressionHandle(sourceHandle) ? 0 : (Number(sourceHandle) || 0),
        fromExpressionId: isExpressionHandle(sourceHandle) ? sourceHandle : undefined,
      });
    },
    [selectedGraphId, createEdge],
  );

  const handleConnect = useCallback(
    (params: Connection) => createEdgeFromConnection(params),
    [createEdgeFromConnection],
  );

  const handleEdgesDelete = useCallback(
    (edgesToDelete: AppFlowEdge[]) => {
      edgesToDelete.forEach(edge => {
        deleteEdge({ edgeId: edge.id, graphId: selectedGraphId });
      });
    },
    [deleteEdge, selectedGraphId],
  );

  const handleReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const handleReconnect = useCallback(
    (oldEdge: AppFlowEdge, newConnection: Connection) => {
      edgeReconnectSuccessful.current = true;
      deleteEdge({ edgeId: oldEdge.id, graphId: selectedGraphId });
      createEdgeFromConnection(newConnection);
    },
    [createEdgeFromConnection, deleteEdge, selectedGraphId],
  );

  const handleReconnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, edge: AppFlowEdge) => {
      if (!edgeReconnectSuccessful.current) {
        deleteEdge({ edgeId: edge.id, graphId: selectedGraphId });
      }
      edgeReconnectSuccessful.current = true;
    },
    [deleteEdge, selectedGraphId],
  );

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      void fitView({ padding: 0.1, maxZoom: 1, duration: 300 });
    },
    [fitView],
  );

  // Run layout when nodes are fully initialized/measured and graph structure changes.
  // Deps are [graphData, nodeState, isFetching] — not [nodes, edges] — so setLayoutData
  // never re-triggers this effect, eliminating the need for a dedup key.
  useEffect(() => {
    if (isFetching || !graphData) return;
    const { nodes: currentNodes, edges: currentEdges } = layoutInputRef.current;
    if (currentNodes.length === 0 || !currentNodes.every(n => n.measured !== undefined)) return;

    let cancelled = false;
    void getLayoutedElements(currentNodes, currentEdges, graphData.expressions)
      .then(({ nodes: ln }) => {
        if (cancelled) return;
        const nextPositions: Record<string, { x: number; y: number }> = {};
        const nextLayers: Record<string, number> = {};
        ln.forEach(n => {
          nextPositions[n.id] = n.position;
          nextLayers[n.id] = n.data?.layer ?? 0;
        });
        setLayoutData({ positions: nextPositions, layers: nextLayers });
      })
      .catch(err => {
        if (!cancelled) console.error('Failed to auto-layout nodes:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [graphData, nodeState, isFetching]);

  const containerStyle = useMemo(() => ({
    width: '100%' as const,
    height: '100%' as const,
    opacity: isReady ? 1 : 0,
    transition: 'opacity 0.2s ease-in-out',
  }), [isReady]);

  if (!graphData) return null;

  return (
    <div style={containerStyle}>
      <ReactFlow<AppFlowNode, AppFlowEdge>
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onConnect={handleConnect}
        onEdgesDelete={handleEdgesDelete}
        onReconnect={handleReconnect}
        onReconnectStart={handleReconnectStart}
        onReconnectEnd={handleReconnectEnd}
        isValidConnection={isValidConnection}
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
