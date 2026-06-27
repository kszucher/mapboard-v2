import type { ElkExtendedEdge, ElkNode, ElkPort, LayoutOptions } from 'elkjs';
import ELK from 'elkjs/lib/elk.bundled.js';

import type { ApiExpression, AppFlowEdge, AppFlowNode } from './types';

const elk = new ELK();

const ELK_LAYOUT_OPTIONS: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.randomSeed': '42',

  // --- GLOBAL PORT CONFIGS ---
  'elk.portConstraints': 'FIXED_POS',

  // Increase spacing to give edges and nodes more breathing room to avoid crossings
  'elk.spacing.nodeNode': '45',
  'elk.layered.spacing.nodeNodeBetweenLayers': '70',
  'elk.spacing.edgeEdge': '20',
  'elk.spacing.edgeNode': '30',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '20',
  'elk.layered.spacing.edgeNodeBetweenLayers': '30',

  // Use Brandes & Köpf placement for more balanced horizontal coordinates and fewer crossings
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',

  // Disable edge straightening to encourage natural offsets, bends, and parallel routing
  'org.eclipse.elk.layered.nodePlacement.bk.edgeStraightening': 'NONE',
  'org.eclipse.elk.layered.nodePlacement.favorStraightEdges': 'false',

  // Enable depth-first cycle breaking to respect our starting node
  'org.eclipse.elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
  // Enable routing of feedback edges around nodes
  'org.eclipse.elk.layered.feedbackEdges': 'true',
  // Increase thoroughness to find layout configurations with fewer crossings
  'org.eclipse.elk.layered.thoroughness': '20',
};

// Maps node models to ELK-compatible node structures
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

    // 1. Target ports (input) on the left (WEST)
    if (nodeType !== 'START') {
      const incomingEdges = edges.filter((e) => e.target === node.id);
      const targetHandles = Array.from(new Set(incomingEdges.map((e) => e.targetHandle ?? 'target')));
      
      targetHandles.forEach((handleId) => {
        const edgesForHandle = incomingEdges.filter((e) => (e.targetHandle ?? 'target') === handleId);
        
        let baseTargetY = isSwitch ? 66 : (nodeHeight / 2);
        let baseTargetX = 0;

        const bounds = node.handleBounds?.target?.find((h: any) => {
          if (!handleId || handleId === 'target') return h.id === null || h.id === undefined || h.id === 'target';
          return h.id === handleId;
        });

        if (bounds && bounds.width > 0 && bounds.height > 0) {
          baseTargetX = bounds.x + (bounds.width / 2);
          baseTargetY = bounds.y + (bounds.height / 2);
        }

        // Create a unique port for each incoming edge connected to this target handle
        edgesForHandle.forEach((edge, index) => {
          const offset = edgesForHandle.length > 1
            ? (index - (edgesForHandle.length - 1) / 2) * 10
            : 0;

          ports.push({
            id: `${node.id}-target-${handleId}-${edge.id}`,
            x: baseTargetX,
            y: baseTargetY + offset,
            width: 0,
            height: 0,
            layoutOptions: { 'port.side': 'WEST' }
          });
        });
      });
    }

    // 2. Source ports (output) on the right (EAST)
    const outgoingEdges = edges.filter((e) => e.source === node.id);
    let sourcePorts = Array.from(new Set(outgoingEdges.map((e) => e.sourceHandle).filter(Boolean) as string[]))
      .sort((a, b) => nodeExpressions.findIndex((expr) => expr.id === a) - nodeExpressions.findIndex((expr) => expr.id === b));

    if (isSwitch) {
      const baseExprId = nodeExpressions.find(e => e.type === 'BASE')?.id;
      sourcePorts = sourcePorts.filter(handleId => handleId !== baseExprId);
    } else {
      if (sourcePorts.length === 0) sourcePorts.push(nodeType === 'START' ? '0' : (nodeExpressions[0]?.id ?? '0'));
    }

    sourcePorts.forEach((handleId) => {
      const exprIdx = nodeExpressions.findIndex((expr) => expr.id === handleId);
      let sourceY = isSwitch && exprIdx !== -1 ? (66 + exprIdx * 40) : (nodeHeight / 2);
      let sourceX = nodeWidth;

      const bounds = node.handleBounds?.source?.find((h: any) => {
        if (!handleId || handleId === '0') return h.id === null || h.id === undefined || h.id === '0' || h.id === handleId;
        return h.id === handleId;
      });

      if (bounds && bounds.width > 0 && bounds.height > 0) {
        sourceX = bounds.x + (bounds.width / 2);
        sourceY = bounds.y + (bounds.height / 2);
      }

      const edgesForHandle = outgoingEdges.filter((edge) => {
        let edgeSourceHandle = edge.sourceHandle;
        if (!edgeSourceHandle) {
          edgeSourceHandle = nodeType === 'START' ? '0' : (nodeExpressions[0]?.id ?? '0');
        }
        return edgeSourceHandle === handleId;
      });

      if (edgesForHandle.length === 0) {
        ports.push({
          id: `${node.id}-source-${handleId}`,
          x: sourceX,
          y: sourceY,
          width: 0,
          height: 0,
          layoutOptions: { 'port.side': 'EAST' }
        });
      } else {
        // Create a unique port for each outgoing edge from this source handle
        edgesForHandle.forEach((edge, index) => {
          const offset = edgesForHandle.length > 1
            ? (index - (edgesForHandle.length - 1) / 2) * 10
            : 0;

          ports.push({
            id: `${node.id}-source-${handleId}-${edge.id}`,
            x: sourceX,
            y: sourceY + offset,
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

// Maps all edges directly to ELK-compatible edge structures
const buildElkEdges = (
  edges: AppFlowEdge[],
  nodes: AppFlowNode[],
  expressions: ApiExpression[]
): ElkExtendedEdge[] => {
  return edges.map((edge) => {
    let sourceHandleId = edge.sourceHandle;

    if (!sourceHandleId) {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const nodeType = sourceNode?.data?.node?.node_type;
      const nodeExpressions = expressions.filter((e) => e.node_id === edge.source);
      sourceHandleId = nodeType === 'START' ? '0' : (nodeExpressions[0]?.id ?? '0');
    }

    const targetHandleId = edge.targetHandle ?? 'target';

    const elkSourcePortId = `${edge.source}-source-${sourceHandleId}-${edge.id}`;
    const elkTargetPortId = `${edge.target}-target-${targetHandleId}-${edge.id}`;

    return {
      id: edge.id,
      sources: [elkSourcePortId],
      targets: [elkTargetPortId],
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
  // Ensure START node is first. Rest can stay in their original order.
  const orderedNodes = [...nodes].sort((a, b) => {
    const isStartA = a.data?.node?.node_type === 'START';
    const isStartB = b.data?.node?.node_type === 'START';
    if (isStartA && !isStartB) return -1;
    if (!isStartA && isStartB) return 1;
    return 0;
  });

  const elkNodes = buildElkNodes(orderedNodes, edges, expressions);
  const elkEdges = buildElkEdges(edges, orderedNodes, expressions); // Fixed tracking here

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