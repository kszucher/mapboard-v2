import type { ElkExtendedEdge, ElkNode, ElkPort, LayoutOptions } from 'elkjs';
import ELK from 'elkjs/lib/elk.bundled.js';

import type { ApiExpression, AppFlowEdge, AppFlowNode } from './types';

const elk = new ELK();

const ELK_LAYOUT_OPTIONS: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.spacing.nodeNode': '20',
  'elk.layered.spacing.nodeNodeBetweenLayers': '40',
  'elk.spacing.edgeEdge': '15',
  'elk.spacing.edgeNode': '20',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '15',
  'elk.layered.spacing.edgeNodeBetweenLayers': '20',
  'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
  'elk.layered.crossingMinimization.semiInteractive': 'false',
  'elk.randomSeed': '42',
};

// Maps node models to ELK-compatible node structures
const buildElkNodes = (
  orderedNodes: AppFlowNode[],
  edges: AppFlowEdge[],
  expressions: ApiExpression[]
): ElkNode[] => {
  return orderedNodes.map((node) => {
    const nodeWidth = node.measured?.width ?? node.width ?? 200;
    const nodeHeight = node.measured?.height ?? node.height ?? 120;
    const nodeType = node.data?.node?.node_type;
    const isSwitch = nodeType === 'LOGICAL_SWITCH' || nodeType === 'AGENTIC_SWITCH';
    const nodeExpressions = expressions.filter((e) => e.node_id === node.id);
    const ports: ElkPort[] = [];

    // 1. Target ports (input) on the left (WEST)
    if (nodeType !== 'START') {
      const targetPorts = Array.from(new Set(edges.filter((e) => e.target === node.id).map((e) => e.targetHandle ?? 'target')));
      targetPorts.forEach((handleId) => {
        const targetY = isSwitch ? 66 : (nodeHeight / 2);
        ports.push({
          id: handleId,
          x: 0,
          y: targetY,
          width: 10,
          height: 10,
        });
      });
    }

    // 2. Source ports (output) on the right (EAST)
    let sourcePorts = Array.from(new Set(edges.filter((e) => e.source === node.id).map((e) => e.sourceHandle).filter(Boolean) as string[]))
      .sort((a, b) => nodeExpressions.findIndex((expr) => expr.id === a) - nodeExpressions.findIndex((expr) => expr.id === b));

    if (isSwitch) {
      const baseExprId = nodeExpressions.find(e => e.type === 'BASE')?.id;
      sourcePorts = sourcePorts.filter(handleId => handleId !== baseExprId);
    } else {
      if (sourcePorts.length === 0) {
        sourcePorts.push(nodeType === 'START' ? '0' : (nodeExpressions[0]?.id ?? '0'));
      }
    }

    sourcePorts.forEach((handleId) => {
      const exprIdx = nodeExpressions.findIndex((expr) => expr.id === handleId);
      const sourceY = isSwitch && exprIdx !== -1 ? (66 + exprIdx * 40) : (nodeHeight / 2);
      ports.push({
        id: handleId,
        x: nodeWidth,
        y: sourceY,
        width: 10,
        height: 10,
      });
    });

    return {
      id: node.id,
      width: nodeWidth,
      height: nodeHeight,
      x: 0,
      y: 0,
      ports,
      layoutOptions: {
        'elk.portConstraints': 'FIXED_POS',
      },
    };
  });
};

// Filters forward edges and maps them to ELK-compatible edge structures.
// Back-edges (edge.data.isBack) are excluded so ELK's layered algorithm doesn't see cycles.
const buildElkEdges = (
  edges: AppFlowEdge[],
  nodesMap: Map<string, AppFlowNode>,
  expressions: ApiExpression[]
): ElkExtendedEdge[] => {
  return edges
    .filter((edge) => !edge.data?.isBack)
    .sort((a, b) => {
      // Sort by source visitOrder, then expression idx, then target visitOrder — all O(1) lookups.
      const voA = nodesMap.get(a.source)?.data?.visitOrder ?? 0;
      const voB = nodesMap.get(b.source)?.data?.visitOrder ?? 0;
      if (voA !== voB) return voA - voB;

      const exprs = expressions.filter((e) => e.node_id === a.source);
      const idxA = a.sourceHandle ? exprs.findIndex((expr) => expr.id === a.sourceHandle) : -1;
      const idxB = b.sourceHandle ? exprs.findIndex((expr) => expr.id === b.sourceHandle) : -1;
      if (idxA !== idxB) return idxA - idxB;

      const voTA = nodesMap.get(a.target)?.data?.visitOrder ?? 0;
      const voTB = nodesMap.get(b.target)?.data?.visitOrder ?? 0;
      return voTA - voTB;
    })
    .map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
      sourcePort: edge.sourceHandle ?? undefined,
      targetPort: edge.targetHandle ?? 'target',
    }));
};

/**
 * Computes deterministic node positions using the ELK layered layout algorithm.
 * Excludes backward edges from the layout pass to stabilize the forward sequence.
 */
export const getLayoutedElements = async (
  nodes: AppFlowNode[],
  edges: AppFlowEdge[],
  expressions: ApiExpression[] = []
): Promise<{ nodes: AppFlowNode[] }> => {
  const nodesMap = new Map(nodes.map((node) => [node.id, node]));

  // Order nodes by visitOrder pre-computed in getDynamicLayers — replaces the BFS traversal.
  const orderedNodes = [...nodes].sort(
    (a, b) => (a.data?.visitOrder ?? 0) - (b.data?.visitOrder ?? 0)
  );
  const elkNodes = buildElkNodes(orderedNodes, edges, expressions);
  const elkEdges = buildElkEdges(edges, nodesMap, expressions);

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: ELK_LAYOUT_OPTIONS,
    children: elkNodes,
    edges: elkEdges,
  };

  const layoutedGraph = await elk.layout(graph);

  const layoutedNodes = nodes.map((node) => {
    const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);
    return {
      ...node,
      position: {
        x: elkNode?.x ?? node.position.x,
        y: elkNode?.y ?? node.position.y,
      },
    };
  });

  return { nodes: layoutedNodes };
};
