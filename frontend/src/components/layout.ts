import type { ElkExtendedEdge, ElkNode, ElkPort, LayoutOptions } from 'elkjs';
import ELK from 'elkjs/lib/elk.bundled.js';

import type { AppFlowEdge, AppFlowNode } from './types';

const elk = new ELK();

const NODE_PADDING = 6;
const ROW_HEIGHT = 30;
const DEFAULT_SOURCE_HANDLE = 'source';
const DEFAULT_TARGET_HANDLE = 'target';

const ELK_LAYOUT_OPTIONS: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.randomSeed': '42',
  'elk.portConstraints': 'FIXED_POS',
  'elk.spacing.nodeNode': '45',
  'elk.spacing.edgeEdge': '20',
  'elk.spacing.edgeNode': '30',
  'elk.layered.spacing.nodeNodeBetweenLayers': '70',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '20',
  'elk.layered.spacing.edgeNodeBetweenLayers': '30',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.thoroughness': '20',
  'org.eclipse.elk.layered.nodePlacement.bk.edgeStraightening': 'NONE',
  'org.eclipse.elk.layered.nodePlacement.favorStraightEdges': 'false',
  'org.eclipse.elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
  'org.eclipse.elk.layered.feedbackEdges': 'true',
};

const rowCenter = (rowIndex: number) =>
  NODE_PADDING / 2 + ROW_HEIGHT * rowIndex + ROW_HEIGHT / 2;

const groupByHandle = (
  edges: AppFlowEdge[],
  key: 'sourceHandle' | 'targetHandle',
  fallback: string
): Record<string, AppFlowEdge[]> =>
  edges.reduce<Record<string, AppFlowEdge[]>>((acc, e) => {
    const id = e[key] ?? fallback;
    (acc[id] ??= []).push(e);
    return acc;
  }, {});

const buildElkNodes = (orderedNodes: AppFlowNode[], edges: AppFlowEdge[]): ElkNode[] => {
  const incomingMap: Record<string, AppFlowEdge[]> = {};
  const outgoingMap: Record<string, AppFlowEdge[]> = {};
  edges.forEach((e) => {
    (incomingMap[e.target] ??= []).push(e);
    (outgoingMap[e.source] ??= []).push(e);
  });

  return orderedNodes.map((node) => {
    const nodeWidth = node.measured?.width ?? node.width ?? 200;
    const nodeType = node.data?.node?.node_type;
    const isStart = nodeType === 'START';
    const isSwitch = nodeType === 'LOGICAL_SWITCH' || nodeType === 'AGENTIC_SWITCH';
    const isJoin = nodeType === 'JOIN';

    const subExpressions = (node.data?.expressions ?? [])
      .filter((e) => e.type === 'SUB')
      .sort((a, b) => a.idx - b.idx);

    const rowCount = isStart ? 1 : isSwitch || isJoin ? 2 + subExpressions.length : 2;
    const nodeHeight = ROW_HEIGHT * rowCount + NODE_PADDING;

    const ports: ElkPort[] = [];

    // WEST ports (incoming)
    Object.entries(groupByHandle(incomingMap[node.id] ?? [], 'targetHandle', DEFAULT_TARGET_HANDLE))
      .forEach(([handleId]) => {
        const exprIdx = subExpressions.findIndex((e) => e.id === handleId);
        const rowIdx = isJoin && exprIdx !== -1 ? 1 + exprIdx : 1;
        ports.push({
          id: `${node.id}-target-${handleId}`,
          x: -NODE_PADDING,
          y: rowCenter(rowIdx),
          width: 0,
          height: 0,
          layoutOptions: { 'port.side': 'WEST' },
        });
      });

    // EAST ports (outgoing)
    Object.entries(groupByHandle(outgoingMap[node.id] ?? [], 'sourceHandle', DEFAULT_SOURCE_HANDLE))
      .forEach(([handleId]) => {
        const exprIdx = subExpressions.findIndex((e) => e.id === handleId);
        let rowIdx = 1;
        if (isStart) rowIdx = 0;
        else if (isSwitch && exprIdx !== -1) rowIdx = 2 + exprIdx;
        else if (isJoin) rowIdx = 1 + subExpressions.length;
        ports.push({
          id: `${node.id}-source-${handleId}`,
          x: nodeWidth + NODE_PADDING,
          y: rowCenter(rowIdx),
          width: 0,
          height: 0,
          layoutOptions: { 'port.side': 'EAST' },
        });
      });

    const layoutOptions: LayoutOptions = { 'elk.portConstraints': 'FIXED_POS' };
    if (isStart) layoutOptions['org.eclipse.elk.layered.layering.layerConstraint'] = 'FIRST';

    return { id: node.id, width: nodeWidth, height: nodeHeight, ports, layoutOptions };
  });
};

const buildElkEdges = (edges: AppFlowEdge[]): ElkExtendedEdge[] =>
  edges.map((edge) => ({
    id: edge.id,
    sources: [`${edge.source}-source-${edge.sourceHandle ?? DEFAULT_SOURCE_HANDLE}`],
    targets: [`${edge.target}-target-${edge.targetHandle ?? DEFAULT_TARGET_HANDLE}`],
  }));

export const getLayoutedElements = async (
  nodes: AppFlowNode[],
  edges: AppFlowEdge[]
): Promise<{
  positions: Record<string, { x: number; y: number }>;
  edgeSections: Record<string, ElkExtendedEdge>;
}> => {
  const orderedNodes = [...nodes].sort((a, b) =>
    (b.data?.node?.node_type === 'START' ? 1 : 0) -
    (a.data?.node?.node_type === 'START' ? 1 : 0)
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
