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
 * - Renders precise ELK-calculated orthogonal path if node positions are aligned
 * - Otherwise falls back to a dynamic smoothstep edge
 * - Prevents backward (right -> left) overlapping in fallback using staggered hashing
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

  // 1. Check if ELK layout is present and aligns with current handle positions
  const sections = data?.sections;
  let useElkPath = false;
  let elkPath = '';

  const isRightToLeft = sourceX > targetX;

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
    
    const isReversedSourceMatch = Math.abs(sourceX - endX) < tolerance && Math.abs(sourceY - endY) < tolerance;
    const isReversedTargetMatch = Math.abs(targetX - startX) < tolerance && Math.abs(targetY - startY) < tolerance;
    
    if ((isSourceMatch && isTargetMatch) || (isReversedSourceMatch && isReversedTargetMatch)) {
      useElkPath = true;
      const isReversed = isReversedSourceMatch && isReversedTargetMatch;
      
      const allPoints: { x: number; y: number }[] = [];
      for (const section of sections) {
        allPoints.push(section.startPoint);
        if (section.bendPoints) {
          allPoints.push(...section.bendPoints);
        }
        allPoints.push(section.endPoint);
      }
      
      // Remove consecutive duplicates
      const uniquePoints = allPoints.filter((pt, idx) => {
        if (idx === 0) return true;
        const prev = allPoints[idx - 1];
        return Math.hypot(pt.x - prev.x, pt.y - prev.y) > 0.1;
      });

      if (isReversed) {
        uniquePoints.reverse();
      }
      
      elkPath = getRoundedOrthogonalPath(uniquePoints, 20);
    }
  }

  // 2. Generate path
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

    const edgeKey = `${id}-${source}-${target}`;
    const hash = getStableHash(edgeKey);
    const offsetIndex = hash % 5; // 0..4

    const staggerRight = 30 + offsetIndex * 15;
    const staggerBottom = 30 + offsetIndex * 15;
    const staggerLeft = 30 + offsetIndex * 15;

    const targetRightX = maxRight + staggerRight;
    const targetBottomY = maxBottom + staggerBottom;
    const targetLeftX = targetX - staggerLeft;

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
