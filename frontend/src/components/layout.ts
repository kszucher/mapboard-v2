import type { ElkExtendedEdge, ElkNode, ElkPort, LayoutOptions } from 'elkjs';
import ELK from 'elkjs/lib/elk.bundled.js';

import type { AppFlowEdge, AppFlowNode } from './types';

const elk = new ELK();

const NODE_PADDING = 6;
const ROW_HEIGHT = 30;
const HANDLE_SPREAD_PX = 10;

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

const getOffset = (i: number, len: number) =>
  len > 1 ? (i - (len - 1) / 2) * HANDLE_SPREAD_PX : 0;

const groupByHandle = (
  edges: AppFlowEdge[],
  key: 'sourceHandle' | 'targetHandle',
  def: string
) =>
  edges.reduce<Record<string, AppFlowEdge[]>>((acc, e) => {
    const id = e[key] ?? def;
    (acc[id] ??= []).push(e);
    return acc;
  }, {});

const rowCenter = (rowIndex: number) => ROW_HEIGHT * rowIndex + ROW_HEIGHT / 2;

const buildElkNodes = (
  orderedNodes: AppFlowNode[],
  edges: AppFlowEdge[]
): ElkNode[] => {
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
    const subExpressions = (node.data?.expressions || [])
      .filter((e) => e.type === 'SUB')
      .sort((a, b) => a.idx - b.idx);

    const rowCount = isStart ? 1 : (isSwitch || isJoin) ? 2 + subExpressions.length : 2;
    const nodeHeight = ROW_HEIGHT * rowCount + NODE_PADDING;

    const ports: ElkPort[] = [];

    // WEST ports (targets)
    const targetGroups = groupByHandle(incomingMap[node.id] || [], 'targetHandle', 'target');
    Object.entries(targetGroups).forEach(([handleId, group]) => {
      const exprIdx = subExpressions.findIndex((e) => e.id === handleId);
      const rowIdx = isJoin && exprIdx !== -1 ? 1 + exprIdx : 1;

      group.forEach((edge, index) => {
        ports.push({
          id: `${node.id}-target-${handleId}-${edge.id}`,
          x: 0,
          y: rowCenter(rowIdx) + getOffset(index, group.length),
          width: 0,
          height: 0,
          layoutOptions: { 'port.side': 'WEST' },
        });
      });
    });

    // EAST ports (sources)
    const sourceGroups = groupByHandle(outgoingMap[node.id] || [], 'sourceHandle', '0');
    Object.entries(sourceGroups).forEach(([handleId, group]) => {
      const exprIdx = subExpressions.findIndex((e) => e.id === handleId);
      let rowIdx = 1;
      if (isStart) {
        rowIdx = 0;
      } else if (isSwitch && exprIdx !== -1) {
        rowIdx = 2 + exprIdx;
      } else if (isJoin) {
        rowIdx = 1 + subExpressions.length;
      }

      group.forEach((edge, index) => {
        ports.push({
          id: `${node.id}-source-${handleId}-${edge.id}`,
          x: nodeWidth,
          y: rowCenter(rowIdx) + getOffset(index, group.length),
          width: 0,
          height: 0,
          layoutOptions: { 'port.side': 'EAST' },
        });
      });
    });

    const nodeLayoutOptions: LayoutOptions = { 'elk.portConstraints': 'FIXED_POS' };
    if (isStart) nodeLayoutOptions['org.eclipse.elk.layered.layering.layerConstraint'] = 'FIRST';

    return {
      id: node.id,
      width: nodeWidth,
      height: nodeHeight,
      ports,
      layoutOptions: nodeLayoutOptions,
    };
  });
};

const buildElkEdges = (edges: AppFlowEdge[]): ElkExtendedEdge[] =>
  edges.map((edge) => ({
    id: edge.id,
    sources: [`${edge.source}-source-${edge.sourceHandle ?? '0'}-${edge.id}`],
    targets: [`${edge.target}-target-${edge.targetHandle ?? 'target'}-${edge.id}`],
  }));

export const getLayoutedElements = async (
  nodes: AppFlowNode[],
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
