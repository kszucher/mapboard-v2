/**
 * Edge Classification Utilities for Agentic AI Workflow Visualization
 *
 * Separates the classification of forward (pipeline flow) and backward (feedback loop) edges.
 * By identifying loop structures based on layers and coordinates, we can isolate them from the
 * main layout calculations and apply specific perimeter routing to improve workflow readability.
 */
import type { AppFlowEdge, AppFlowNode } from '../types';


// Helper to sort nodes deterministically by iid and id
export const sortNodesByIdAndIid = (a: AppFlowNode, b: AppFlowNode): number => {
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

  const sortedStart = nodes.filter((n) => n.data?.node?.node_type === 'START').sort(sortNodesByIdAndIid);
  const sortedOther = nodes.filter((n) => n.data?.node?.node_type !== 'START').sort(sortNodesByIdAndIid);
  [...sortedStart, ...sortedOther].forEach((n) => {
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

  return layerMap;
};

/**
 * Determines whether an edge is a backward edge.
 * Supports passing handle X coordinates directly (for runtime rendering offsets) or node positions (for layout).
 */
export const checkIsBackEdge = (
  sourceNode: AppFlowNode | undefined,
  targetNode: AppFlowNode | undefined,
  layerMap: Map<string, number>,
  sourceX?: number,
  targetX?: number,
  ignoreCoordinates = false
): boolean => {
  if (!sourceNode || !targetNode) return false;

  const sourceLayer = layerMap.get(sourceNode.id);
  const targetLayer = layerMap.get(targetNode.id);

  if (sourceLayer !== undefined && targetLayer !== undefined && sourceLayer >= targetLayer) {
    return true;
  }

  return !ignoreCoordinates && (sourceX ?? (sourceNode.position.x + (sourceNode.measured?.width ?? sourceNode.width ?? 200))) >= (targetX ?? targetNode.position.x);
};

/**
 * Assigns a unique track index to each backedge using an Interval Coloring (greedy channel routing) algorithm.
 * Shorter loops (inner loops) are processed first to receive lower track indexes.
 * Ties are broken using source/target Y positions (descending) to avoid vertical crossing.
 * Reads layer from node.data.layer (pre-computed during layout) — no separate layerMap needed.
 */
export const assignBackLinkTracks = (
  edges: AppFlowEdge[],
  nodes: AppFlowNode[],
): Map<string, number> => {
  const nodesMap = new Map(nodes.map((n) => [n.id, n]));
  const getLayer = (nodeId: string) => nodesMap.get(nodeId)?.data?.layer ?? 0;

  // edge.data.isBack is pre-computed in Flow.tsx — no graph traversal needed here
  const backEdges = edges.filter((e) => e.data?.isBack);

  backEdges.sort((a, b) => {
    const lenA = getLayer(a.source) - getLayer(a.target);
    const lenB = getLayer(b.source) - getLayer(b.target);
    const sA = nodesMap.get(a.source)!, tA = nodesMap.get(a.target)!;
    const sB = nodesMap.get(b.source)!, tB = nodesMap.get(b.target)!;
    return lenA - lenB || sB.position.y - sA.position.y || tB.position.y - tA.position.y || a.id.localeCompare(b.id);
  });

  const trackMap = new Map<string, number>();
  const trackIntervals: AppFlowEdge[][] = [];

  for (const edge of backEdges) {
    const s = getLayer(edge.source);
    const t = getLayer(edge.target);
    let assignedTrack = trackIntervals.findIndex((track) =>
      !track.some((ex) => {
        const exS = getLayer(ex.source), exT = getLayer(ex.target);
        return exS === s || exT === t || Math.max(exT, t) < Math.min(exS, s);
      })
    );

    if (assignedTrack === -1) assignedTrack = trackIntervals.push([]) - 1;
    trackIntervals[assignedTrack].push(edge);
    trackMap.set(edge.id, assignedTrack);
  }

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

// Computes the rounded orthogonal backlink route path.
// Reads layer from node.data.layer (pre-computed during layout) — no layerMap parameter needed.
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
): string => {
  const nodesMap = new Map(allNodes.map((n) => [n.id, n]));
  const getLayer = (nodeId: string) => nodesMap.get(nodeId)?.data?.layer ?? 0;

  const trackMap = assignBackLinkTracks(allEdges, allNodes);
  const track = trackMap.get(id) ?? 0;

  const sLayer = getLayer(source);
  const tLayer = getLayer(target);

  const maxRight = allNodes
    .filter((n) => getLayer(n.id) === sLayer)
    .reduce((max, n) => Math.max(max, n.position.x + (n.measured?.width ?? n.width ?? 200)), -Infinity);

  const getSubLaneIndex = (nodeField: 'source' | 'target', layerTarget: number) => {
    const filtered = allEdges.filter((e) => e.data?.isBack && getLayer(e[nodeField]) === layerTarget);
    const sorted = [...filtered].sort((a, b) => (trackMap.get(a.id) ?? 0) - (trackMap.get(b.id) ?? 0));
    return Math.max(0, sorted.findIndex((e) => e.id === id));
  };

  const activeSourceSubLaneIndex = getSubLaneIndex('source', sLayer);
  const activeTargetSubLaneIndex = getSubLaneIndex('target', tLayer);

  const localMaxY = allNodes
    .filter((n) => getLayer(n.id) <= sLayer)
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
