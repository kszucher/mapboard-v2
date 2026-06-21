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
  const { getNode } = useReactFlow();

  const sourceNode = source ? getNode(source) : null;
  const targetNode = target ? getNode(target) : null;

  // 1. Check if ELK layout is present and aligns with current handle positions
  const sections = data?.sections;
  let useElkPath = false;
  let elkPath = '';

  if (sections && sections.length > 0) {
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
      let path = '';
      for (const section of sections) {
        const points = [
          section.startPoint,
          ...(section.bendPoints || []),
          section.endPoint,
        ];
        path += (path ? ' ' : '') + getRoundedOrthogonalPath(points, 20);
      }
      elkPath = path;
    }
  }

  // 2. Generate fallback path if ELK layout is not active/aligned
  const isRightToLeft = sourceX > targetX;

  const getNodeBottom = (node: typeof sourceNode) => {
    if (!node) return null;
    const height = node.measured?.height ?? node.height ?? node.data?.height ?? 80;
    return node.position.y + (height as number);
  };

  let centerY: number | undefined;
  if (isRightToLeft && sourceNode && targetNode) {
    const sourceBottom = getNodeBottom(sourceNode);
    const targetBottom = getNodeBottom(targetNode);

    if (sourceBottom !== null && targetBottom !== null) {
      const lowerBottom = Math.max(sourceBottom, targetBottom);
      
      // Calculate a stable staggered offset using a hash of the edge key to prevent overlapping
      const edgeKey = `${id}-${source}-${target}`;
      const hash = getStableHash(edgeKey);
      const offset = 20 + (hash % 5) * 15; // Spreads offsets: 20px, 35px, 50px, 65px, 80px
      centerY = lowerBottom + offset;
    }
  }

  const [fallbackPath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 30,
    ...(centerY !== undefined && { centerY }),
  });

  return (
    <BaseEdge
      path={useElkPath ? elkPath : fallbackPath}
      markerEnd={markerEnd}
      style={style}
    />
  );
}

export default memo(FlowEdge);
