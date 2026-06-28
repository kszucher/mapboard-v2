import type { ElkExtendedEdge, ElkNode, ElkPort, LayoutOptions } from 'elkjs';
import ELK from 'elkjs/lib/elk.bundled.js';

import type { AppFlowEdge, AppFlowNode } from './types';

const elk = new ELK();

const ELK_LAYOUT_OPTIONS: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.randomSeed': '42',
  'elk.portConstraints': 'FIXED_POS',
  'elk.spacing.nodeNode': '45',
  'elk.layered.spacing.nodeNodeBetweenLayers': '70',
  'elk.spacing.edgeEdge': '20',
  'elk.spacing.edgeNode': '30',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '20',
  'elk.layered.spacing.edgeNodeBetweenLayers': '30',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'org.eclipse.elk.layered.nodePlacement.bk.edgeStraightening': 'NONE',
  'org.eclipse.elk.layered.nodePlacement.favorStraightEdges': 'false',
  'org.eclipse.elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
  'org.eclipse.elk.layered.feedbackEdges': 'true',
  'org.eclipse.elk.layered.thoroughness': '20',
};

interface XYHandleBounds {
  id?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NodeHandleBounds {
  target?: XYHandleBounds[];
  source?: XYHandleBounds[];
}

const findHandleBounds = (list: XYHandleBounds[] | undefined, handleId: string | null | undefined, def: string) =>
  list?.find((h) => (h.id || def) === (handleId || def));

const getOffset = (i: number, len: number) => len > 1 ? (i - (len - 1) / 2) * 10 : 0;

const buildElkNodes = (
  orderedNodes: (AppFlowNode & { handleBounds?: NodeHandleBounds })[],
  edges: AppFlowEdge[]
): ElkNode[] => {
  const incomingMap: Record<string, AppFlowEdge[]> = {};
  const outgoingMap: Record<string, AppFlowEdge[]> = {};
  edges.forEach((e) => {
    (incomingMap[e.target] ??= []).push(e);
    (outgoingMap[e.source] ??= []).push(e);
  });

  return orderedNodes.map((node) => {
    const { measured, width } = node;
    const nodeWidth = measured?.width ?? width ?? 200;

    const nodeType = node.data?.node?.node_type;
    const isStart = nodeType === 'START';
    const isSwitch = nodeType === 'LOGICAL_SWITCH' || nodeType === 'AGENTIC_SWITCH';
    const nodeExpressions = node.data?.expressions || [];
    const subExpressions = nodeExpressions.filter((e) => e.type === 'SUB').sort((a, b) => a.idx - b.idx);
    const subCount = subExpressions.length;

    // Total rows (M): Start has 1 (Header), Switch has 2 + N, standard has 2 (Header + Base)
    const rowCount = isStart ? 1 : (isSwitch ? 2 + subCount : 2);
    const nodeHeight = 30 * rowCount + 6;

    const ports: ElkPort[] = [];

    // WEST ports (targets)
    const incoming = incomingMap[node.id] || [];
    const targetGroups: Record<string, AppFlowEdge[]> = {};
    incoming.forEach((e) => (targetGroups[e.targetHandle ?? 'target'] ??= []).push(e));

    Object.entries(targetGroups).forEach(([handleId, group]) => {
      const bounds = findHandleBounds(node.handleBounds?.target, handleId, 'target');
      const x = bounds && bounds.width > 0 ? bounds.x + bounds.width / 2 : 0;
      const y = bounds && bounds.height > 0 ? bounds.y + bounds.height / 2 : 48; // Row 1 center (30 * 1 + 18)

      group.forEach((edge, index) => {
        ports.push({
          id: `${node.id}-target-${handleId}-${edge.id}`,
          x,
          y: y + getOffset(index, group.length),
          width: 0,
          height: 0,
          layoutOptions: { 'port.side': 'WEST' }
        });
      });
    });

    // EAST ports (sources)
    const outgoing = outgoingMap[node.id] || [];
    const sourceGroups: Record<string, AppFlowEdge[]> = {};
    outgoing.forEach((e) => (sourceGroups[e.sourceHandle ?? '0'] ??= []).push(e));

    Object.entries(sourceGroups).forEach(([handleId, group]) => {
      const exprIdx = subExpressions.findIndex((e) => e.id === handleId);
      const bounds = findHandleBounds(node.handleBounds?.source, handleId, '0');
      const x = bounds && bounds.width > 0 ? bounds.x + bounds.width / 2 : nodeWidth;

      const fallbackRowIdx = isStart ? 0 : (isSwitch && exprIdx !== -1 ? 2 + exprIdx : 1);
      const y = bounds && bounds.height > 0 ? bounds.y + bounds.height / 2 : 30 * fallbackRowIdx + 18;

      group.forEach((edge, index) => {
        ports.push({
          id: `${node.id}-source-${handleId}-${edge.id}`,
          x,
          y: y + getOffset(index, group.length),
          width: 0,
          height: 0,
          layoutOptions: { 'port.side': 'EAST' }
        });
      });
    });

    const nodeLayoutOptions: LayoutOptions = { 'elk.portConstraints': 'FIXED_POS' };
    if (nodeType === 'START') nodeLayoutOptions['org.eclipse.elk.layered.layering.layerConstraint'] = 'FIRST';

    return {
      id: node.id,
      width: nodeWidth,
      height: nodeHeight,
      ports,
      layoutOptions: nodeLayoutOptions,
    };
  });
};

const buildElkEdges = (edges: AppFlowEdge[]): ElkExtendedEdge[] => {
  return edges.map((edge) => {
    const sourceHandleId = edge.sourceHandle ?? '0';
    const targetHandleId = edge.targetHandle ?? 'target';

    return {
      id: edge.id,
      sources: [`${edge.source}-source-${sourceHandleId}-${edge.id}`],
      targets: [`${edge.target}-target-${targetHandleId}-${edge.id}`],
    };
  });
};

/**
 * Computes deterministic node positions and edge layout sections using ELK.
 */
export const getLayoutedElements = async (
  nodes: (AppFlowNode & { handleBounds?: NodeHandleBounds })[],
  edges: AppFlowEdge[]
): Promise<{
  positions: Record<string, { x: number; y: number }>;
  edgeSections: Record<string, ElkExtendedEdge>;
}> => {
  const orderedNodes = [...nodes].sort((a, b) =>
    (b.data?.node?.node_type === 'START' ? 1 : 0) - (a.data?.node?.node_type === 'START' ? 1 : 0)
  );

  const layoutedGraph = await elk.layout({
    id: 'root',
    layoutOptions: ELK_LAYOUT_OPTIONS,
    children: buildElkNodes(orderedNodes, edges),
    edges: buildElkEdges(edges),
  });

  const positions: Record<string, { x: number; y: number }> = {};
  layoutedGraph.children?.forEach((n) => {
    positions[n.id] = { x: n.x ?? 0, y: n.y ?? 0 };
  });

  const edgeSections: Record<string, ElkExtendedEdge> = {};
  layoutedGraph.edges?.forEach((e) => {
    edgeSections[e.id] = e;
  });

  return { positions, edgeSections };
};
