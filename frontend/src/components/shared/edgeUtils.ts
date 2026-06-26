import type { ApiEdge, ApiNode, AppFlowEdge, AppFlowNode } from '../types';

// Augmented edge type carrying pre-indexed expression order and pre-computed routing fields.
type LayerEdge = ApiEdge & { expressionIdx: number; isBack?: boolean; track?: number };

// Augmented node type carrying pre-computed layer depth and DFS visit order.
type LayerNode = ApiNode & { layer?: number; visitOrder?: number };

/**
 * Assigns topological layer depths, visit order, and back-edge routing tracks in a single pass.
 *
 * Adjacency lists are sorted by `expressionIdx` — the canonical child ordering defined by the
 * parent node's expression indices. Back edges (cycles) are detected via DFS and assigned a
 * `track` index using greedy interval coloring, so routing is fully computable before layout runs.
 *
 * START nodes are visited first to anchor the ordering. All mutations are in-place.
 */
export const getDynamicLayers = (nodes: LayerNode[], edges: LayerEdge[] = []): void => {
  const nodesMap = new Map(nodes.map((n) => [n.id, Object.assign(n, { layer: 0 })]));

  // Build adjacency list sorted by expressionIdx — the correct child ordering key.
  const adj = new Map<string, LayerEdge[]>();
  for (const edge of edges) {
    const list = adj.get(edge.from_node_id) ?? [];
    if (!adj.has(edge.from_node_id)) adj.set(edge.from_node_id, list);
    list.push(edge);
  }
  for (const [, list] of adj) {
    list.sort((a, b) => a.expressionIdx - b.expressionIdx || a.id.localeCompare(b.id));
  }

  // DFS for back-edge detection + topo order.
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const backEdges = new Set<string>();
  const topoOrder: string[] = [];

  let visitCounter = 0;
  const dfs = (nodeId: string) => {
    visiting.add(nodeId);
    nodesMap.get(nodeId)!.visitOrder = visitCounter++; // pre-order: assign on entry
    for (const edge of adj.get(nodeId) ?? []) {
      if (visiting.has(edge.to_node_id)) backEdges.add(edge.id);
      else if (!visited.has(edge.to_node_id)) dfs(edge.to_node_id);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    topoOrder.push(nodeId);
  };

  const sorted = [
    ...nodes.filter((n) => n.node_type === 'START').sort((a, b) => a.id.localeCompare(b.id)),
    ...nodes.filter((n) => n.node_type !== 'START').sort((a, b) => a.id.localeCompare(b.id)),
  ];
  for (const n of sorted) {
    if (!visited.has(n.id)) dfs(n.id);
  }
  topoOrder.reverse();

  // Kahn-style layer propagation along topo order.
  for (const nodeId of topoOrder) {
    const node = nodesMap.get(nodeId)!;
    for (const edge of adj.get(nodeId) ?? []) {
      if (backEdges.has(edge.id)) continue;
      const target = nodesMap.get(edge.to_node_id);
      if (target) target.layer = Math.max(target.layer!, node.layer! + 1);
    }
  }

  for (const edge of edges) edge.isBack = backEdges.has(edge.id);

  // Greedy interval coloring for back-edge tracks.
  // Shorter spans first; ties broken by source visitOrder descending so lower nodes on screen
  // get lower track numbers.
  const backEdgeList = edges.filter((e) => e.isBack);
  backEdgeList.sort((a, b) => {
    const fromA = nodesMap.get(a.from_node_id)!, fromB = nodesMap.get(b.from_node_id)!;
    const toA = nodesMap.get(a.to_node_id)!, toB = nodesMap.get(b.to_node_id)!;
    const lenA = (fromA.layer ?? 0) - (toA.layer ?? 0);
    const lenB = (fromB.layer ?? 0) - (toB.layer ?? 0);
    return lenA - lenB
      || (fromB.visitOrder ?? 0) - (fromA.visitOrder ?? 0)
      || (toB.visitOrder ?? 0) - (toA.visitOrder ?? 0)
      || a.id.localeCompare(b.id);
  });

  const tracks: Array<[number, number][]> = [];
  for (const edge of backEdgeList) {
    const lo = nodesMap.get(edge.to_node_id)?.layer ?? 0;  // target = earlier layer
    const hi = nodesMap.get(edge.from_node_id)?.layer ?? 0; // source = later layer
    const freeTrack = tracks.findIndex((intervals) =>
      intervals.every(([a, b]) => hi < a || lo > b)
    );
    const track = freeTrack !== -1 ? freeTrack : tracks.push([]) - 1;
    tracks[track].push([lo, hi]);
    edge.track = track;
  }
};

/** Constructs an SVG path string from orthogonal waypoints with rounded corners. */
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

/**
 * Computes the rounded orthogonal path for a back (feedback) edge.
 *
 * Routes via the right perimeter of the source layer and below the lowest node in that layer,
 * using pre-computed `track` and sub-lane indices to avoid overlap between concurrent back edges.
 */
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

  const track = allEdges.find((e) => e.id === id)?.data?.track ?? 0;

  const sLayer = getLayer(source);
  const tLayer = getLayer(target);

  const maxRight = allNodes
    .filter((n) => getLayer(n.id) === sLayer)
    .reduce((max, n) => Math.max(max, n.position.x + (n.measured?.width ?? n.width ?? 200)), -Infinity);

  const getSubLaneIndex = (nodeField: 'source' | 'target', layerTarget: number) => {
    const filtered = allEdges.filter((e) => e.data?.isBack && getLayer(e[nodeField]) === layerTarget);
    const sorted = [...filtered].sort((a, b) => (a.data?.track ?? 0) - (b.data?.track ?? 0));
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
