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

// DFS cycle detection to identify backward edges
const findBackEdges = (
  nodes: AppFlowNode[],
  edges: AppFlowEdge[],
  nodesMap: Map<string, AppFlowNode>
): Set<string> => {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const backEdges = new Set<string>();

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
  };

  // Process START nodes first, then remaining nodes, both sorted deterministically
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

  return backEdges;
};

// Topological DAG depth calculator
const computeTopologicalLayers = (
  nodes: AppFlowNode[],
  forwardEdges: AppFlowEdge[]
): Map<string, number> => {
  const layerMap = new Map(nodes.map((n) => [n.id, 0]));
  const inDegree = new Map(nodes.map((n) => [n.id, 0]));

  for (const edge of forwardEdges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  const roots = nodes
    .filter((n) => (inDegree.get(n.id) || 0) === 0)
    .sort((a, b) => {
      const isStartA = a.data?.node?.node_type === 'START' ? 1 : 0;
      const isStartB = b.data?.node?.node_type === 'START' ? 1 : 0;
      return isStartB - isStartA || sortNodesByIdAndIid(a, b);
    });

  const topoQueue = roots.map((n) => n.id);
  const topoOrder: string[] = [];

  while (topoQueue.length > 0) {
    const current = topoQueue.shift()!;
    topoOrder.push(current);

    const outgoing = forwardEdges.filter((e) => e.source === current);
    outgoing.sort((a, b) => a.target.localeCompare(b.target));

    for (const edge of outgoing) {
      const target = edge.target;
      inDegree.set(target, (inDegree.get(target) || 1) - 1);
      if (inDegree.get(target) === 0) {
        topoQueue.push(target);
      }
    }
  }

  for (const nodeId of topoOrder) {
    const currentLayer = layerMap.get(nodeId) || 0;
    const outgoing = forwardEdges.filter((e) => e.source === nodeId);
    for (const edge of outgoing) {
      const target = edge.target;
      layerMap.set(target, Math.max(layerMap.get(target) || 0, currentLayer + 1));
    }
  }

  return layerMap;
};

/**
 * Computes topological layers for each node deterministically using a cycle-breaking DFS
 * followed by DAG depth calculation. This replaces coordinate-based dynamic clustering.
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
  const backEdges = findBackEdges(nodes, edges, nodesMap);
  const forwardEdges = edges.filter(
    (e) => !backEdges.has(e.id) && nodesMap.has(e.source) && nodesMap.has(e.target)
  );

  lastNodesForLayers = nodes;
  lastEdgesForLayers = edges;
  return (lastLayerMap = computeTopologicalLayers(nodes, forwardEdges));
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
  backlinkIntervals.sort((a, b) => {
    if (a.length !== b.length) {
      return a.length - b.length;
    }
    if (a.sourceY !== b.sourceY) {
      return b.sourceY - a.sourceY;
    }
    if (a.targetY !== b.targetY) {
      return b.targetY - a.targetY;
    }
    return a.id.localeCompare(b.id);
  });

  const trackMap = new Map<string, number>();
  const trackIntervals: BackEdgeInterval[][] = [];

  for (const interval of backlinkIntervals) {
    let assignedTrack = -1;

    for (let trackIdx = 0; trackIdx < trackIntervals.length; trackIdx++) {
      let hasOverlap = false;
      for (const existing of trackIntervals[trackIdx]) {
        // Overlap if they share source layer or target layer
        const shareSourceOrTarget =
          existing.sourceLayer === interval.sourceLayer ||
          existing.targetLayer === interval.targetLayer;
        
        // Overlap if their open intervals intersect
        const openIntervalOverlap =
          Math.max(existing.targetLayer, interval.targetLayer) <
          Math.min(existing.sourceLayer, interval.sourceLayer);

        if (shareSourceOrTarget || openIntervalOverlap) {
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
