import { BaseEdge, type EdgeProps, getBezierPath } from '@xyflow/react';
import { memo } from 'react';
import { getRoundedOrthogonalPath } from './shared/edgeUtils';
import type { AppFlowEdge } from './types';

/**
 * Custom FlowEdge component.
 * Renders edges using ELK's calculated sections/bendpoints, falling back to Bezier paths.
 */
function FlowEdge({
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
  const sections = data?.sections;
  const isBack = data?.isBack;
  let path = '';

  if (!isBack) {
    path = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    })[0];
  } else if (sections && sections.length > 0) {
    path = sections
      .map((section: any) => {
        const bendPoints = (section.bendPoints || []).map((p: any) => ({ x: p.x, y: p.y }));
        if (bendPoints.length > 0) {
          bendPoints[0].y = sourceY;
          bendPoints[bendPoints.length - 1].y = targetY;
        }
        const points = [
          { x: sourceX, y: sourceY },
          ...bendPoints,
          { x: targetX, y: targetY },
        ];
        return getRoundedOrthogonalPath(points, 10);
      })
      .join(' ');
  } else {
    path = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    })[0];
  }

  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}

export default memo(FlowEdge);
