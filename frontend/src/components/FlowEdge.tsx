import { BaseEdge, type EdgeProps, getSmoothStepPath } from '@xyflow/react';

export default function FlowEdge({
                                   sourceX,
                                   sourceY,
                                   targetX,
                                   targetY,
                                   sourcePosition,
                                   targetPosition,
                                   style = {},
                                   markerEnd,
                                 }: EdgeProps) {
  const isRightToLeft = sourceX > targetX;

  const lowerNodeY = Math.max(sourceY, targetY);
  const forcedCenterY = lowerNodeY + 20;

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 30,
    ...(isRightToLeft && { centerY: forcedCenterY }),
  });

  return (
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd}
      style={style}
    />
  );
}
