import ELK from 'elkjs/lib/elk.bundled.js';
import type { AppFlowNode, AppFlowEdge, ApiExpression } from './types';

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

export const getLayoutedElements = async (
  nodes: AppFlowNode[],
  edges: AppFlowEdge[],
  expressions: ApiExpression[] = []
): Promise<{ nodes: AppFlowNode[]; edges: AppFlowEdge[] }> => {
  // 1. Sort nodes deterministically using a BFS starting from START nodes
  const startNodes = nodes.filter((n) => n.data?.node?.node_type === 'START');
  const orderedNodes: AppFlowNode[] = [];
  const visited = new Set<string>();
  const queue: AppFlowNode[] = [...startNodes];

  if (queue.length === 0 && nodes[0]) {
    queue.push(nodes[0]);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    orderedNodes.push(current);

    // Find direct children targeted by edges from this node
    const outgoingEdges = edges.filter((e) => e.source === current.id);

    // Sort outgoing edges by handle/expression order to guarantee sibling contiguity and order
    const currentExpressions = expressions.filter((e) => e.node_id === current.id);
    outgoingEdges.sort((a, b) => {
      const idxA = a.sourceHandle ? currentExpressions.findIndex((expr) => expr.id === a.sourceHandle) : -1;
      const idxB = b.sourceHandle ? currentExpressions.findIndex((expr) => expr.id === b.sourceHandle) : -1;

      if (idxA !== idxB) {
        return idxA - idxB;
      }

      const nodeA = nodes.find((n) => n.id === a.target);
      const nodeB = nodes.find((n) => n.id === b.target);

      const yA = nodeA?.position?.y ?? 0;
      const yB = nodeB?.position?.y ?? 0;
      if (yA !== yB) {
        return yA - yB;
      }

      const iidA = nodeA?.data?.node?.iid ?? 0;
      const iidB = nodeB?.data?.node?.iid ?? 0;
      if (iidA !== iidB) {
        return iidA - iidB;
      }

      return a.target.localeCompare(b.target);
    });

    const childrenIds = outgoingEdges.map((e) => e.target);

    for (const childId of childrenIds) {
      const childNode = nodes.find((n) => n.id === childId);
      if (childNode && !visited.has(childId)) {
        queue.push(childNode);
      }
    }
  }

  // Add any unvisited (disconnected) nodes, sorted deterministically
  const remainingNodes = nodes
    .filter((node) => !visited.has(node.id))
    .sort((a, b) => (a.data?.node?.label || '').localeCompare(b.data?.node?.label || '') || a.id.localeCompare(b.id));

  for (const node of remainingNodes) {
    orderedNodes.push(node);
  }

  const elkNodes = orderedNodes.map((node) => {
    const nodeWidth = node.measured?.width ?? node.width ?? 200;
    const nodeHeight = node.measured?.height ?? node.height ?? 120;
    const nodeType = node.data?.node?.node_type;

    const ports: ElkPort[] = [];

    const isSwitch = nodeType === 'LOGICAL_SWITCH' || nodeType === 'AGENTIC_SWITCH';
    const nodeExpressions = expressions.filter((e) => e.node_id === node.id);

    // 1. Target ports (input) on the left (WEST)
    if (nodeType !== 'START') {
      const targetPorts = Array.from(new Set(edges.filter((e) => e.target === node.id).map((e) => e.targetHandle ?? 'target')));
      targetPorts.forEach((handleId) => {
        const targetY = isSwitch ? (66 + ((Math.max(1, nodeExpressions.length) - 1) * 40) / 2) : (nodeHeight / 2);
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
    const sourcePorts = Array.from(new Set(edges.filter((e) => e.source === node.id).map((e) => e.sourceHandle).filter(Boolean) as string[]));
    if (sourcePorts.length === 0) {
      sourcePorts.push(nodeType === 'START' ? '0' : (nodeExpressions[0]?.id ?? '0'));
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
      x: node.position.x,
      y: node.position.y,
      ports,
      layoutOptions: {
        'elk.portConstraints': 'FIXED_POS',
      },
    };
  });

  const elkEdges = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
    sourcePort: edge.sourceHandle ?? undefined,
    targetPort: edge.targetHandle ?? 'target',
  }));

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': '50',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.edgeEdge': '15',
      'elk.spacing.edgeNode': '20',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '15',
      'elk.layered.spacing.edgeNodeBetweenLayers': '20',
      'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.crossingMinimization.forceNodeModelOrder': true,
      'elk.layered.crossingMinimization.semiInteractive': true,
      'elk.randomSeed': '42',
    } as any,
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

  const layoutedEdges = edges.map((edge) => {
    const elkEdge = (layoutedGraph.edges as any[])?.find((e) => e.id === edge.id);
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
