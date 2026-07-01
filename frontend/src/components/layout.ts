import type { ElkExtendedEdge, ElkNode, ElkPort, LayoutOptions } from 'elkjs';
import ELK from 'elkjs/lib/elk.bundled.js';
import {
  type ApiExpression,
  type AppFlowEdge,
  type AppFlowNode,
  hasExpressionActions,
  hasLeftHandle,
  hasRightHandle
} from './types';

const elk = new ELK();

export const NODE_PADDING = 6;

const ROW_HEIGHT = 30;
const START_END_NODE_WIDTH = 200;
const INDENT_SIZE = 24;
const NODE_HORIZONTAL_PADDING = 12;
const INPUT_PADDING_WITH_HANDLE = 12;
const INPUT_PADDING_WITHOUT_HANDLE = 24;
const ACTIONS_BUTTON_WIDTH = 24;
const TEXT_MEASUREMENT_BUFFER = 16;
const MIN_EDITOR_WIDTH = 240;

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

const getUniqueHandles = (
  edges: AppFlowEdge[],
  key: 'sourceHandle' | 'targetHandle'
): string[] => {
  return Array.from(
    new Set(edges.map((e) => e[key]).filter((id): id is string => !!id))
  );
};

let canvasContext: CanvasRenderingContext2D | null = null;

export const measureTextWidth = (text: string, font: string = '13px Consolas, Menlo, Monaco, "Courier New", monospace'): number => {
  if (typeof window === 'undefined') return 0;
  canvasContext ??= document.createElement('canvas').getContext('2d');
  if (!canvasContext) return 0;
  canvasContext.font = font;
  return canvasContext.measureText(text).width;
};

export const getNodeDimensions = (
  nodeType: string,
  expressions: ApiExpression[]
): { width: number; height: number } => {
  const isStartOrEnd = nodeType === 'START' || nodeType === 'END';
  if (isStartOrEnd) {
    return {
      width: START_END_NODE_WIDTH,
      height: ROW_HEIGHT * (1 + expressions.length) + NODE_PADDING,
    };
  }

  const indentPadding = (nodeType === 'AGENT' || nodeType === 'LOGIC') ? 0 : INDENT_SIZE;

  const editorWidths = expressions.map((expr) => {
    const textWidth = measureTextWidth(expr.raw_string || '');
    const leftPadding = hasLeftHandle(expr.type) ? INPUT_PADDING_WITH_HANDLE : INPUT_PADDING_WITHOUT_HANDLE;
    const rightPadding = hasRightHandle(expr.type) ? INPUT_PADDING_WITH_HANDLE : INPUT_PADDING_WITHOUT_HANDLE;
    const actionsWidth = hasExpressionActions(expr.type, nodeType) ? ACTIONS_BUTTON_WIDTH : 0;

    return textWidth + leftPadding + rightPadding + actionsWidth + TEXT_MEASUREMENT_BUFFER;
  });

  const maxEditorWidth = Math.max(MIN_EDITOR_WIDTH, ...editorWidths);
  const nodeWidth = maxEditorWidth + indentPadding + NODE_HORIZONTAL_PADDING;

  return {
    width: nodeWidth,
    height: ROW_HEIGHT * (1 + expressions.length) + NODE_PADDING,
  };
};

const buildElkNodes = (nodes: AppFlowNode[], edges: AppFlowEdge[]): ElkNode[] => {
  const incomingMap: Record<string, AppFlowEdge[]> = {};
  const outgoingMap: Record<string, AppFlowEdge[]> = {};
  edges.forEach((e) => {
    (incomingMap[e.target] ??= []).push(e);
    (outgoingMap[e.source] ??= []).push(e);
  });

  return nodes.map((node) => {
    const nodeType = node.data?.node?.node_type ?? '';
    const expressions = node.data?.expressions ?? [];
    const isStart = nodeType === 'START';
    const isEnd = nodeType === 'END';

    const { width: nodeWidth, height: nodeHeight } = getNodeDimensions(nodeType, expressions);

    const ports: ElkPort[] = [];

    // WEST ports (incoming)
    getUniqueHandles(incomingMap[node.id] ?? [], 'targetHandle')
      .forEach((handleId) => {
        const exprIdx = expressions.findIndex((e) => e.id === handleId);
        const rowIdx = exprIdx !== -1 ? 1 + exprIdx : 1;
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
    getUniqueHandles(outgoingMap[node.id] ?? [], 'sourceHandle')
      .forEach((handleId) => {
        const exprIdx = expressions.findIndex((e) => e.id === handleId);
        const rowIdx = exprIdx !== -1 ? 1 + exprIdx : 1;
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
    if (isEnd) layoutOptions['org.eclipse.elk.layered.layering.layerConstraint'] = 'LAST';

    return { id: node.id, width: nodeWidth, height: nodeHeight, ports, layoutOptions };
  });
};

const buildElkEdges = (edges: AppFlowEdge[]): ElkExtendedEdge[] =>
  edges.map((edge) => ({
    id: edge.id,
    sources: [`${edge.source}-source-${edge.sourceHandle}`],
    targets: [`${edge.target}-target-${edge.targetHandle}`],
  }));

export const getLayoutedElements = async (
  nodes: AppFlowNode[],
  edges: AppFlowEdge[]
): Promise<{
  positions: Record<string, { x: number; y: number }>;
  edgeSections: Record<string, ElkExtendedEdge>;
}> => {
  const startTime = performance.now();
  const layoutedGraph = await elk.layout({
    id: 'root',
    layoutOptions: ELK_LAYOUT_OPTIONS,
    children: buildElkNodes(nodes, edges),
    edges: buildElkEdges(edges),
  });
  const duration = performance.now() - startTime;
  console.log(`[ELK Layout] took ${duration.toFixed(2)}ms`);

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
