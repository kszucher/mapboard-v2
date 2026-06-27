import type { ElkExtendedEdge, ElkNode, ElkPort, LayoutOptions } from 'elkjs';
import ELK from 'elkjs/lib/elk.bundled.js';

import type { ApiExpression, AppFlowEdge, AppFlowNode } from './types';

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

const getSourceHandleId = (edge: AppFlowEdge, node: AppFlowNode | undefined, exprs: ApiExpression[]) =>
  edge.sourceHandle ?? (node?.data?.node?.node_type === 'START' ? '0' : (exprs.filter((e) => e.node_id === edge.source)[0]?.id ?? '0'));

const findHandleBounds = (list: any[] | undefined, handleId: string | null | undefined, def: string) =>
  list?.find((h: any) => !handleId || handleId === def ? !h.id || h.id === def : h.id === handleId);

const getOffset = (i: number, len: number) => len > 1 ? (i - (len - 1) / 2) * 10 : 0;

const buildElkNodes = (
  orderedNodes: (AppFlowNode & { handleBounds?: any })[],
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

    // WEST ports (targets)
    if (nodeType !== 'START') {
      const incoming = edges.filter((e) => e.target === node.id);
      const handles = Array.from(new Set(incoming.map((e) => e.targetHandle ?? 'target')));
      
      handles.forEach((handleId) => {
        const group = incoming.filter((e) => (e.targetHandle ?? 'target') === handleId);
        const bounds = findHandleBounds(node.handleBounds?.target, handleId, 'target');
        const x = bounds && bounds.width > 0 ? bounds.x + bounds.width / 2 : 0;
        const y = bounds && bounds.height > 0 ? bounds.y + bounds.height / 2 : (isSwitch ? 66 : nodeHeight / 2);

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
    }

    // EAST ports (sources)
    const outgoing = edges.filter((e) => e.source === node.id);
    let sourceHandles = Array.from(new Set(outgoing.map((e) => e.sourceHandle).filter(Boolean) as string[]))
      .sort((a, b) => nodeExpressions.findIndex((e) => e.id === a) - nodeExpressions.findIndex((e) => e.id === b));

    if (isSwitch) {
      sourceHandles = sourceHandles.filter(h => h !== nodeExpressions.find(e => e.type === 'BASE')?.id);
    } else if (sourceHandles.length === 0) {
      sourceHandles.push(nodeType === 'START' ? '0' : (nodeExpressions[0]?.id ?? '0'));
    }

    sourceHandles.forEach((handleId) => {
      const exprIdx = nodeExpressions.findIndex((e) => e.id === handleId);
      const bounds = findHandleBounds(node.handleBounds?.source, handleId, '0');
      const x = bounds && bounds.width > 0 ? bounds.x + bounds.width / 2 : nodeWidth;
      const y = bounds && bounds.height > 0 ? bounds.y + bounds.height / 2 : (isSwitch && exprIdx !== -1 ? 66 + exprIdx * 40 : nodeHeight / 2);

      const group = outgoing.filter((e) => getSourceHandleId(e, node, expressions) === handleId);

      if (group.length === 0) {
        ports.push({
          id: `${node.id}-source-${handleId}`,
          x,
          y,
          width: 0,
          height: 0,
          layoutOptions: { 'port.side': 'EAST' }
        });
      } else {
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
      }
    });

    const nodeLayoutOptions: any = { 'elk.portConstraints': 'FIXED_POS' };
    if (nodeType === 'START') nodeLayoutOptions['org.eclipse.elk.layered.layering.layerConstraint'] = 'FIRST';

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

const buildElkEdges = (
  edges: AppFlowEdge[],
  nodes: AppFlowNode[],
  expressions: ApiExpression[]
): ElkExtendedEdge[] => {
  return edges.map((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const sourceHandleId = getSourceHandleId(edge, sourceNode, expressions);
    const targetHandleId = edge.targetHandle ?? 'target';

    return {
      id: edge.id,
      sources: [`${edge.source}-source-${sourceHandleId}-${edge.id}`],
      targets: [`${edge.target}-target-${targetHandleId}-${edge.id}`],
    };
  });
};

/**
 * Computes deterministic node positions using the ELK layered layout algorithm.
 * Uses ELK's native cycle breaking and feedback edge routing.
 */
export const getLayoutedElements = async (
  nodes: (AppFlowNode & { handleBounds?: any })[],
  edges: AppFlowEdge[],
  expressions: ApiExpression[] = []
): Promise<{ nodes: AppFlowNode[]; edges: ElkExtendedEdge[] }> => {
  const orderedNodes = [...nodes].sort((a, b) => 
    (b.data?.node?.node_type === 'START' ? 1 : 0) - (a.data?.node?.node_type === 'START' ? 1 : 0)
  );

  const layoutedGraph = await elk.layout({
    id: 'root',
    layoutOptions: ELK_LAYOUT_OPTIONS,
    children: buildElkNodes(orderedNodes, edges, expressions),
    edges: buildElkEdges(edges, orderedNodes, expressions),
  });

  const layoutedNodes = nodes.map((node) => {
    const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);
    return {
      ...node,
      position: elkNode ? { x: elkNode.x ?? node.position.x, y: elkNode.y ?? node.position.y } : node.position,
    };
  });

  return { nodes: layoutedNodes, edges: layoutedGraph.edges ?? [] };
};