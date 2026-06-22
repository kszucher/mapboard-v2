/**
 * Edge Classification Utilities for Agentic AI Workflow Visualization
 * 
 * Separates the classification of forward (pipeline flow) and backward (feedback loop) edges.
 * By identifying loop structures based on layers and coordinates, we can isolate them from the 
 * main layout calculations and apply specific perimeter routing to improve workflow readability.
 */
import type { AppFlowNode, AppFlowEdge } from '../types';

/**
 * Extracts the layer number from a node data structure.
 */
export const getLayer = (node: AppFlowNode | undefined): number | undefined => {
  if (!node) return undefined;
  const nodeData = node.data as Record<string, unknown> | undefined;
  const innerNode = nodeData?.node as Record<string, unknown> | undefined;
  const val = nodeData?.layer ?? innerNode?.layer ?? (node as unknown as Record<string, unknown>)?.layer;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

// Module-level caches for React component re-render performance optimization
let lastNodesForLayers: AppFlowNode[] | null = null;
let lastEdgesForLayers: AppFlowEdge[] | null = null;
let lastLayerMap: Map<string, number> | null = null;

// Helper to sort nodes deterministically by iid and id
const sortNodesByIdAndIid = (a: AppFlowNode, b: AppFlowNode): number => {
  return (a.data?.node?.iid ?? 0) - (b.data?.node?.iid ?? 0) || a.id.localeCompare(b.id);
};

/**
 * Computes topological layers for each node deterministically using a single DFS pass
 * that simultaneously breaks cycle back-edges and generates topological finish order.
 */
export const getDynamicLayers = (
  nodes: AppFlowNode[],
  edges: AppFlowEdge[] = []
): Map<string, number> => {
  if (
    lastNodesForLayers === nodes &&
    lastEdgesForLayers === edges &&
    lastLayerMap !== null
  ) {
    return lastLayerMap;
  }

  const nodesMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const backEdges = new Set<string>();
  const topoOrder: string[] = [];

  const dfs = (nodeId: string) => {
    visiting.add(nodeId);

    const outgoing = edges.filter((e) => e.source === nodeId);
    outgoing.sort((a, b) => {
      const handleA = a.sourceHandle || '';
      const handleB = b.sourceHandle || '';
      if (handleA !== handleB) return handleA.localeCompare(handleB);
      
      const targetA = nodesMap.get(a.target);
      const targetB = nodesMap.get(b.target);
      return targetA && targetB ? sortNodesByIdAndIid(targetA, targetB) : a.target.localeCompare(b.target);
    });

    for (const edge of outgoing) {
      if (visiting.has(edge.target)) {
        backEdges.add(edge.id);
      } else if (!visited.has(edge.target)) {
        dfs(edge.target);
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    topoOrder.unshift(nodeId);
  };

  // Traverse all nodes starting from START nodes first
  nodes
    .filter((n) => n.data?.node?.node_type === 'START')
    .sort(sortNodesByIdAndIid)
    .forEach((n) => {
      if (!visited.has(n.id)) dfs(n.id);
    });

  nodes
    .filter((n) => !visited.has(n.id))
    .sort(sortNodesByIdAndIid)
    .forEach((n) => {
      if (!visited.has(n.id)) dfs(n.id);
    });

  // Calculate topological depths along the topological order
  const layerMap = new Map(nodes.map((n) => [n.id, 0]));
  for (const nodeId of topoOrder) {
    const currentLayer = layerMap.get(nodeId) || 0;
    const outgoing = edges.filter((e) => e.source === nodeId && !backEdges.has(e.id));
    for (const edge of outgoing) {
      layerMap.set(edge.target, Math.max(layerMap.get(edge.target) || 0, currentLayer + 1));
    }
  }

  lastNodesForLayers = nodes;
  lastEdgesForLayers = edges;
  return (lastLayerMap = layerMap);
};

/**
 * Determines whether an edge is a backward edge.
 * Supports passing handle X coordinates directly (for runtime rendering offsets) or node positions (for layout).
 */
export const checkIsBackEdge = (
  sourceNode: AppFlowNode | undefined,
  targetNode: AppFlowNode | undefined,
  layerMap?: Map<string, number>,
  sourceX?: number,
  targetX?: number,
  ignoreCoordinates = false
): boolean => {
  if (!sourceNode || !targetNode) return false;

  const sourceLayer = layerMap ? layerMap.get(sourceNode.id) : getLayer(sourceNode);
  const targetLayer = layerMap ? layerMap.get(targetNode.id) : getLayer(targetNode);

  if (sourceLayer !== undefined && targetLayer !== undefined) {
    if (sourceLayer >= targetLayer) return true;
  }

  if (ignoreCoordinates) return false;

  // If sourceX is not provided, estimate it using the node's width to represent the EAST handle.
  const sWidth = sourceNode.measured?.width ?? sourceNode.width ?? 200;
  const sX = sourceX ?? (sourceNode.position.x + sWidth);
  const tX = targetX ?? targetNode.position.x;

  return sX >= tX;
};

let lastEdgesRef: AppFlowEdge[] | null = null;
let lastNodesRef: AppFlowNode[] | null = null;
let lastTrackMap: Map<string, number> | null = null;

/**
 * Assigns a unique track index to each backedge using an Interval Coloring (greedy channel routing) algorithm.
 * Shorter loops (inner loops) are processed first to receive lower track indexes.
 * Ties are broken using source/target Y positions (descending) to avoid vertical crossing.
 * Optimized with O(1) node lookup and reference-caching across multi-edge rendering passes.
 */
export const assignBackLinkTracks = (
  edges: AppFlowEdge[],
  nodes: AppFlowNode[],
  layerMap: Map<string, number>
): Map<string, number> => {
  if (lastEdgesRef === edges && lastNodesRef === nodes && lastTrackMap !== null) {
    return lastTrackMap;
  }

  interface BackEdgeInterval {
    id: string;
    sourceLayer: number;
    targetLayer: number;
    sourceY: number;
    targetY: number;
    length: number;
    edge: AppFlowEdge;
  }

  const nodesMap = new Map<string, AppFlowNode>();
  for (const node of nodes) {
    nodesMap.set(node.id, node);
  }

  const backlinkIntervals: BackEdgeInterval[] = [];

  for (const edge of edges) {
    const sourceNode = nodesMap.get(edge.source);
    const targetNode = nodesMap.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    const isBack = checkIsBackEdge(sourceNode, targetNode, layerMap);
    if (!isBack) continue;

    const sourceLayer = layerMap.get(sourceNode.id) ?? 0;
    const targetLayer = layerMap.get(targetNode.id) ?? 0;
    const sourceY = sourceNode.position.y;
    const targetY = targetNode.position.y;

    backlinkIntervals.push({
      id: edge.id,
      sourceLayer,
      targetLayer,
      sourceY,
      targetY,
      length: sourceLayer - targetLayer,
      edge,
    });
  }

  // Sort intervals:
  // 1. Shorter length first (inner loops get lower track indices)
  // 2. Descending Y position of source node (lower node gets processed first, getting lower track index)
  // 3. Descending Y position of target node (lower target gets processed first, getting lower track index)
  backlinkIntervals.sort(
    (a, b) =>
      a.length - b.length ||
      b.sourceY - a.sourceY ||
      b.targetY - a.targetY ||
      a.id.localeCompare(b.id)
  );

  const trackMap = new Map<string, number>();
  const trackIntervals: BackEdgeInterval[][] = [];

  for (const interval of backlinkIntervals) {
    let assignedTrack = -1;

    for (let trackIdx = 0; trackIdx < trackIntervals.length; trackIdx++) {
      let hasOverlap = false;
      for (const existing of trackIntervals[trackIdx]) {
        const share = existing.sourceLayer === interval.sourceLayer || existing.targetLayer === interval.targetLayer;
        const intersect = Math.max(existing.targetLayer, interval.targetLayer) < Math.min(existing.sourceLayer, interval.sourceLayer);
        if (share || intersect) {
          hasOverlap = true;
          break;
        }
      }

      if (!hasOverlap) {
        assignedTrack = trackIdx;
        break;
      }
    }

    if (assignedTrack === -1) {
      assignedTrack = trackIntervals.length;
      trackIntervals.push([interval]);
    } else {
      trackIntervals[assignedTrack].push(interval);
    }

    trackMap.set(interval.id, assignedTrack);
  }

  lastEdgesRef = edges;
  lastNodesRef = nodes;
  lastTrackMap = trackMap;
  return trackMap;
};

// Helper to construct an SVG path string from orthogonal points with rounded corners
export function getRoundedOrthogonalPath(points: { x: number; y: number }[], radius = 20): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const len1 = Math.hypot(dx1, dy1);

    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len2 = Math.hypot(dx2, dy2);

    const r = Math.min(radius, len1 / 2, len2 / 2);

    if (r > 0) {
      const p1x = curr.x - (dx1 / len1) * r;
      const p1y = curr.y - (dy1 / len1) * r;
      const p2x = curr.x + (dx2 / len2) * r;
      const p2y = curr.y + (dy2 / len2) * r;

      path += ` L ${p1x} ${p1y} Q ${curr.x} ${curr.y} ${p2x} ${p2y}`;
    } else {
      path += ` L ${curr.x} ${curr.y}`;
    }
  }

  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return path;
}

// Computes the rounded orthogonal backlink route path
export const getBacklinkPath = (
  id: string,
  source: string,
  target: string,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  allNodes: AppFlowNode[],
  allEdges: AppFlowEdge[],
  layerMap: Map<string, number>
): string => {
  const trackMap = assignBackLinkTracks(allEdges, allNodes, layerMap);
  const track = trackMap.get(id) ?? 0;

  const nodesMap = new Map(allNodes.map((n) => [n.id, n]));
  const sLayer = layerMap.get(source);
  const tLayer = layerMap.get(target);

  const maxRight = allNodes
    .filter((n) => layerMap.get(n.id) === sLayer)
    .reduce((max, n) => Math.max(max, n.position.x + (n.measured?.width ?? n.width ?? 200)), -Infinity);

  const mappedEdges = allEdges.map((e) => ({
    edge: e,
    sNode: nodesMap.get(e.source)!,
    tNode: nodesMap.get(e.target)!,
  }));

  const getSubLaneIndex = (matchNodeField: 'sNode' | 'tNode', layerTarget: number | undefined) => {
    const filtered = mappedEdges.filter(
      (x) => x.sNode && x.tNode && checkIsBackEdge(x.sNode, x.tNode, layerMap) && layerMap.get(x[matchNodeField].id) === layerTarget
    );
    const sorted = [...filtered].sort((a, b) => (trackMap.get(a.edge.id) ?? 0) - (trackMap.get(b.edge.id) ?? 0));
    const idx = sorted.findIndex((x) => x.edge.id === id);
    return idx !== -1 ? idx : 0;
  };

  const activeSourceSubLaneIndex = getSubLaneIndex('sNode', sLayer);
  const activeTargetSubLaneIndex = getSubLaneIndex('tNode', tLayer);

  const localMaxY = allNodes
    .filter((n) => {
      const nLayer = layerMap.get(n.id);
      return nLayer !== undefined && sLayer !== undefined && nLayer <= sLayer;
    })
    .reduce((max, n) => Math.max(max, n.position.y + (n.measured?.height ?? n.height ?? 120)), -Infinity);

  const localBottom = localMaxY === -Infinity ? 500 : localMaxY;
  const bottomLaneY = localBottom + 80 + track * 20;
  const localRightX = (maxRight === -Infinity ? sourceX : maxRight) + 40 + activeSourceSubLaneIndex * 10;
  const targetApproachX = targetX - (35 + activeTargetSubLaneIndex * 10);

  const points = [
    { x: sourceX, y: sourceY },
    { x: localRightX, y: sourceY },
    { x: localRightX, y: bottomLaneY },
    { x: targetApproachX, y: bottomLaneY },
    { x: targetApproachX, y: targetY },
    { x: targetX, y: targetY },
  ];

  return getRoundedOrthogonalPath(points, 20);
};
