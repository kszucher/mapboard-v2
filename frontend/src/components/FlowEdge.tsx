import { BaseEdge, type EdgeProps, getSmoothStepPath, useReactFlow } from '@xyflow/react'
import { memo } from 'react'
import type { AppFlowEdge } from './types'

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

/**
 * Custom FlowEdge
 * - Renders precise ELK-calculated orthogonal path if node positions are aligned (forward edges only)
 * - Custom around-the-graph detour path for backlinks (right-to-left)
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
  data,
}: EdgeProps<AppFlowEdge>) {
  const { getNodes } = useReactFlow();

  const isRightToLeft = sourceX > targetX;
  const sections = data?.sections;
  let useElkPath = false;
  let elkPath = '';

  // 1. Process ELK layout path (forward edges only)
  if (!isRightToLeft && sections && sections.length > 0) {
    const firstSection = sections[0];
    const lastSection = sections[sections.length - 1];
    
    const startX = firstSection.startPoint.x;
    const startY = firstSection.startPoint.y;
    const endX = lastSection.endPoint.x;
    const endY = lastSection.endPoint.y;
    
    // Check alignment with a 5px tolerance
    const tolerance = 5;
    const isSourceMatch = Math.abs(sourceX - startX) < tolerance && Math.abs(sourceY - startY) < tolerance;
    const isTargetMatch = Math.abs(targetX - endX) < tolerance && Math.abs(targetY - endY) < tolerance;
    
    if (isSourceMatch && isTargetMatch) {
      useElkPath = true;
      let pathStr = '';
      for (const section of sections) {
        const points = [
          section.startPoint,
          ...(section.bendPoints || []),
          section.endPoint,
        ];
        pathStr += (pathStr ? ' ' : '') + getRoundedOrthogonalPath(points, 20);
      }
      elkPath = pathStr;
    }
  }

  // 2. Generate final path
  let path = '';

  if (isRightToLeft) {
    const allNodes = getNodes();
    let maxRight = -Infinity;
    let maxBottom = -Infinity;

    for (const node of allNodes) {
      const width = node.measured?.width ?? node.width ?? 200;
      const height = node.measured?.height ?? node.height ?? 120;
      const right = node.position.x + width;
      const bottom = node.position.y + height;

      if (right > maxRight) maxRight = right;
      if (bottom > maxBottom) maxBottom = bottom;
    }

    // Default fallbacks in case maxRight or maxBottom is invalid
    if (maxRight === -Infinity) maxRight = Math.max(sourceX, targetX) + 100;
    if (maxBottom === -Infinity) maxBottom = Math.max(sourceY, targetY) + 100;

    const hash = getStableHash(`${id}-${source}-${target}`);
    const stagger = 30 + (hash % 5) * 15; // Spreads offsets: 30px, 45px, 60px, 75px, 90px

    const targetRightX = maxRight + stagger;
    const targetBottomY = maxBottom + stagger;
    const targetLeftX = targetX - stagger;

    const points = [
      { x: sourceX, y: sourceY },
      { x: targetRightX, y: sourceY },
      { x: targetRightX, y: targetBottomY },
      { x: targetLeftX, y: targetBottomY },
      { x: targetLeftX, y: targetY },
      { x: targetX, y: targetY },
    ];

    path = getRoundedOrthogonalPath(points, 20);
  } else if (useElkPath) {
    path = elkPath;
  } else {
    // Generate fallback path for forward edges if ELK is not aligned
    const [fallbackPath] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 30,
    });
    path = fallbackPath;
  }

  return (
    <BaseEdge
      path={path}
      markerEnd={markerEnd}
      style={style}
    />
  );
}

export default memo(FlowEdge);
