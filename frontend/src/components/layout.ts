import type { ElkExtendedEdge, ElkNode, ElkPort, LayoutOptions } from 'elkjs';
import ELK from 'elkjs/lib/elk.bundled.js';

import type { ApiExpression, AppFlowEdge, AppFlowNode } from './types';

const elk = new ELK();

const ELK_LAYOUT_OPTIONS: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.randomSeed': '42',

  'elk.spacing.nodeNode': '20',
  'elk.layered.spacing.nodeNodeBetweenLayers': '40',
  'elk.spacing.edgeEdge': '15',
  'elk.spacing.edgeNode': '20',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '15',
  'elk.layered.spacing.edgeNodeBetweenLayers': '20',

  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',

  // Enable depth-first cycle breaking to respect our starting node
  'org.eclipse.elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
  // Enable routing of feedback edges around nodes
  'org.eclipse.elk.layered.feedbackEdges': 'true',
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

    const nodeLayoutOptions: any = {
      'elk.portConstraints': 'FIXED_POS',
    };

    if (nodeType === 'START') {
      nodeLayoutOptions['org.eclipse.elk.layered.layering.layerConstraint'] = 'FIRST';
    }

    return {
      id: node.id,
      width: nodeWidth,
      height: nodeHeight,
      x: 0,
      y: 0,
      ports,
      layoutOptions: nodeLayoutOptions,
    };
  });
};

// Maps all edges directly to ELK-compatible edge structures
const buildElkEdges = (edges: AppFlowEdge[]): ElkExtendedEdge[] => {
  return edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
    sourcePort: edge.sourceHandle ?? undefined,
    targetPort: edge.targetHandle ?? 'target',
  }));
};

/**
 * Computes deterministic node positions using the ELK layered layout algorithm.
 * Uses ELK's native cycle breaking and feedback edge routing.
 */
export const getLayoutedElements = async (
  nodes: AppFlowNode[],
  edges: AppFlowEdge[],
  expressions: ApiExpression[] = []
): Promise<{ nodes: AppFlowNode[]; edges: ElkExtendedEdge[] }> => {
  // Ensure START node is first. Rest can stay in their original order.
  const orderedNodes = [...nodes].sort((a, b) => {
    const isStartA = a.data?.node?.node_type === 'START';
    const isStartB = b.data?.node?.node_type === 'START';
    if (isStartA && !isStartB) return -1;
    if (!isStartA && isStartB) return 1;
    return 0;
  });

  const elkNodes = buildElkNodes(orderedNodes, edges, expressions);
  const elkEdges = buildElkEdges(edges);

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

  return {
    nodes: layoutedNodes,
    edges: layoutedGraph.edges ?? [],
  };
};
