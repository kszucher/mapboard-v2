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
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 30, // "Curvy smoothstep" look
  });

  return <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />;
}
