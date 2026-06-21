import { BaseEdge, type EdgeProps, getSmoothStepPath, useReactFlow } from '@xyflow/react'
import { memo } from 'react'

/**
 * Custom FlowEdge
 * - Smoothstep edge with curved corners
 * - If source is to the right of target, horizontal segment
 *   is 20px below the lower of the two nodes' bottoms
 */
function FlowEdge({
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
}: EdgeProps) {
  const { getNode } = useReactFlow();

  const sourceNode = source ? getNode(source) : null;
  const targetNode = target ? getNode(target) : null;

  // Check if edge goes right → left
  const isRightToLeft = sourceX > targetX;

  // Helper to safely get bottom Y of a node
  const getNodeBottom = (node: typeof sourceNode) => {
    if (!node) return null;
    const height = node.measured?.height ?? node.height ?? node.data?.height ?? 80; // Fallback to 80px if unknown
    return node.position.y + (height as number);
  };

  // Compute horizontal segment position (centerY)
  let centerY: number | undefined;
  if (isRightToLeft && sourceNode && targetNode) {
    const sourceBottom = getNodeBottom(sourceNode);
    const targetBottom = getNodeBottom(targetNode);

    if (sourceBottom !== null && targetBottom !== null) {
      const lowerBottom = Math.max(sourceBottom, targetBottom);
      centerY = lowerBottom + 20; // 20px below the lower node
    }
  }

  // Compute the smoothstep path
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 30, // curvy look
    ...(centerY !== undefined && { centerY }),
  });

  return (
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd}
      style={style}
    />
  );
}

export default memo(FlowEdge);
