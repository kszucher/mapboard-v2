import { BaseEdge, type EdgeProps, getBezierPath, useReactFlow } from '@xyflow/react'
import { memo } from 'react'
import type { AppFlowEdge, AppFlowNode } from './types'

// Helper to generate a stable, positive 32-bit integer hash from a string
function getStableHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Helper to construct an SVG path string from orthogonal points with rounded corners
function getRoundedOrthogonalPath(points: { x: number; y: number }[], radius = 20) {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Vector from prev to curr
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const len1 = Math.hypot(dx1, dy1);

    // Vector from curr to next
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len2 = Math.hypot(dx2, dy2);

    // Ensure the radius doesn't exceed half the segment lengths
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

interface GraphHull {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

// Compute the AABB hull of all nodes with 60px padding
function computeGraphHull(nodes: AppFlowNode[]): GraphHull {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const width = node.measured?.width ?? node.width ?? 200;
    const height = node.measured?.height ?? node.height ?? 120;
    const left = node.position.x;
    const right = node.position.x + width;
    const top = node.position.y;
    const bottom = node.position.y + height;

    if (left < minX) minX = left;
    if (right > maxX) maxX = right;
    if (top < minY) minY = top;
    if (bottom > maxY) maxY = bottom;
  }

  if (minX === Infinity) {
    return { left: 0, right: 0, top: 0, bottom: 0 };
  }

  const padding = 60;
  return {
    left: minX - padding,
    right: maxX + padding,
    top: minY - padding,
    bottom: maxY + padding,
  };
}

/**
 * Custom FlowEdge
 * - Renders precise ELK-calculated orthogonal path if node positions are aligned (forward edges only)
 * - Custom around-the-graph detour path for backlinks (right-to-left or sourceLayer > targetLayer)
 * - SmoothStep fallback path for forward edges when not aligned
 */
function FlowEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps<AppFlowEdge>) {
  const { getNodes } = useReactFlow();

  const allNodes = getNodes();

  // Helper to extract node layer
  const getLayer = (node: AppFlowNode | undefined): number | undefined => {
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

  const sourceNode = allNodes.find((n) => n.id === source) as AppFlowNode | undefined;
  const targetNode = allNodes.find((n) => n.id === target) as AppFlowNode | undefined;
  const sourceLayer = getLayer(sourceNode);
  const targetLayer = getLayer(targetNode);

  // Stronger semantic rule: sourceLayer > targetLayer OR sourceX > targetX
  const isBackEdge =
    sourceLayer !== undefined && targetLayer !== undefined
      ? sourceX > targetX || sourceLayer > targetLayer
      : sourceX > targetX;

  const getPath = (): string => {
    if (isBackEdge) {
      // ROUTE: BACKEDGE PERIMETER PATH
      const hull = computeGraphHull(allNodes as AppFlowNode[]);

      const MAX_LANES = 8;
      const hashVal = getStableHash(id);
      const laneIndex = hashVal % MAX_LANES;

      const corridorMargin = 80;
      const laneGap = 20;

      const corridorX = hull.right + corridorMargin;
      const corridorY = hull.bottom + corridorMargin;

      const rightLaneX = corridorX + laneIndex * laneGap;
      const bottomLaneY = corridorY + laneIndex * laneGap;
      const targetApproachX = targetX - 40;

      const points = [
        { x: sourceX, y: sourceY },
        { x: rightLaneX, y: sourceY },
        { x: rightLaneX, y: bottomLaneY },
        { x: targetApproachX, y: bottomLaneY },
        { x: targetApproachX, y: targetY },
        { x: targetX, y: targetY },
      ];

      return getRoundedOrthogonalPath(points, 20);
    } else {
      // Generate bezier curve path for forward edges
      const [bezierPath] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      });
      return bezierPath;
    }
  };

  const path = getPath();

  return (
    <BaseEdge
      path={path}
      markerEnd={markerEnd}
      style={style}
    />
  );
}

export default memo(FlowEdge);

