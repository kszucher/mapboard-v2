import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { memo } from 'react';
import { getRoundedOrthogonalPath } from './shared/edgeUtils';
import type { AppFlowEdge } from './types';

/**
 * Custom FlowEdge component.
 * Renders edges using ELK's calculated sections/bendpoints, falling back to Bezier paths.
 */
function FlowEdge({
  sourceX,
  sourceY, // <-- React Flow's exact physical DOM coordinate
  targetX,
  targetY, // <-- React Flow's exact physical DOM coordinate
  style = {},
  markerEnd,
  data,
}: EdgeProps<AppFlowEdge>) {
  const sections = data?.sections;
  let path = '';

  if (sections && sections.length > 0) {
    path = sections
      .map((section) => {
        // 1. Extract ELK's global routing corners
        const bendPoints = (section.bendPoints || []).map((p) => ({ x: p.x, y: p.y }));

        // 2. ABSORB THE CSS DISCREPANCY
        // Force ELK's first and last horizontal routing lanes to shift up/down
        // by the 1-2 pixels required to perfectly match the physical DOM handles.
        if (bendPoints.length > 0) {
          bendPoints[0].y = sourceY;
          bendPoints[bendPoints.length - 1].y = targetY;
        }

        // 3. Sandwich the clamped bend points between the true React Flow anchors
        const points = [
          { x: sourceX, y: sourceY },
          ...bendPoints,
          { x: targetX, y: targetY },
        ];

        // 4. Send to your custom SVG generator
        return getRoundedOrthogonalPath(points, 30);
      })
      .join(' ');
  }

  return <BaseEdge path={path} markerEnd={markerEnd} style={style}/>;
}

export default memo(FlowEdge);
