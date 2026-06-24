import type { ElkExtendedEdge, ElkNode, LayoutOptions } from 'elkjs';
import ELK from 'elkjs/lib/elk.bundled.js';
import { checkIsBackEdge, getDynamicLayers, sortNodesByIdAndIid } from './shared/edgeUtils';
import type { ApiExpression, AppFlowEdge, AppFlowNode } from './types';

const elk = new ELK();

interface ElkPort {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  properties?: {
    'port.side'?: 'WEST' | 'EAST' | 'NORTH' | 'SOUTH';
  };
}

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

// Generates deterministic BFS traversal node list
const getDeterministicBFSOrder = (
  nodes: AppFlowNode[],
  edges: AppFlowEdge[],
  expressions: ApiExpression[],
  nodesMap: Map<string, AppFlowNode>
): AppFlowNode[] => {
  const startNodes = nodes.filter((n) => n.data?.node?.node_type === 'START');
  const orderedNodes: AppFlowNode[] = [];
  const visited = new Set<string>();
  const queue: AppFlowNode[] = startNodes.length > 0 ? [...startNodes] : (nodes[0] ? [nodes[0]] : []);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    orderedNodes.push(current);

    const outgoingEdges = edges.filter((e) => e.source === current.id);
    const currentExpressions = expressions.filter((e) => e.node_id === current.id);

    outgoingEdges.sort((a, b) => {
      const idxA = a.sourceHandle ? currentExpressions.findIndex((expr) => expr.id === a.sourceHandle) : -1;
      const idxB = b.sourceHandle ? currentExpressions.findIndex((expr) => expr.id === b.sourceHandle) : -1;
      if (idxA !== idxB) return idxA - idxB;

      const nodeA = nodesMap.get(a.target);
      const nodeB = nodesMap.get(b.target);
      return nodeA && nodeB ? sortNodesByIdAndIid(nodeA, nodeB) : a.target.localeCompare(b.target);
    });

    for (const edge of outgoingEdges) {
      const childNode = nodesMap.get(edge.target);
      if (childNode && !visited.has(edge.target)) {
        queue.push(childNode);
      }
    }
  }

  // Append remaining unvisited nodes deterministically sorted
  nodes
    .filter((node) => !visited.has(node.id))
    .sort((a, b) => (a.data?.node?.label || '').localeCompare(b.data?.node?.label || '') || a.id.localeCompare(b.id))
    .forEach((node) => orderedNodes.push(node));

  return orderedNodes;
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
          properties: { 'port.side': 'WEST' },
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
        properties: { 'port.side': 'EAST' },
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

// Filters and sorts edges deterministically for ELK
const buildElkEdges = (
  edges: AppFlowEdge[],
  nodesMap: Map<string, AppFlowNode>,
  layerMap: Map<string, number>,
  orderedNodes: AppFlowNode[],
  expressions: ApiExpression[]
): ElkExtendedEdge[] => {
  return edges
    .filter((edge) => {
      const sNode = nodesMap.get(edge.source);
      const tNode = nodesMap.get(edge.target);
      return !checkIsBackEdge(sNode, tNode, layerMap, undefined, undefined, true);
    })
    .sort((a, b) => {
      const idxSourceA = orderedNodes.findIndex((n) => n.id === a.source);
      const idxSourceB = orderedNodes.findIndex((n) => n.id === b.source);
      if (idxSourceA !== idxSourceB) return idxSourceA - idxSourceB;

      const exprs = expressions.filter((e) => e.node_id === a.source);
      const idxA = a.sourceHandle ? exprs.findIndex((expr) => expr.id === a.sourceHandle) : -1;
      const idxB = b.sourceHandle ? exprs.findIndex((expr) => expr.id === b.sourceHandle) : -1;
      if (idxA !== idxB) return idxA - idxB;

      const idxTargetA = orderedNodes.findIndex((n) => n.id === a.target);
      const idxTargetB = orderedNodes.findIndex((n) => n.id === b.target);
      return idxTargetA - idxTargetB;
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
): Promise<{ nodes: AppFlowNode[]; edges: AppFlowEdge[] }> => {
  const nodesMap = new Map(nodes.map((node) => [node.id, node]));

  const orderedNodes = getDeterministicBFSOrder(nodes, edges, expressions, nodesMap);
  const elkNodes = buildElkNodes(orderedNodes, edges, expressions);

  const layerMap = getDynamicLayers(nodes, edges);
  const elkEdges = buildElkEdges(edges, nodesMap, layerMap, orderedNodes, expressions);

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
      data: {
        ...node.data,
        layer: layerMap.get(node.id) ?? 0,
      },
    };
  });

  const layoutedEdges = edges.map((edge) => {
    const elkEdge = layoutedGraph.edges?.find((e) => e.id === edge.id);
    return {
      ...edge,
      data: {
        ...edge.data,
        sections: elkEdge?.sections || [],
      },
    };
  });

  return { nodes: layoutedNodes, edges: layoutedEdges };
};
