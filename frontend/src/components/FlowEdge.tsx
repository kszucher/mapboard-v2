import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { memo } from 'react';
import { getRoundedOrthogonalPath } from './shared/edgeUtils';
import type { AppFlowEdge } from './types';

/**
 * Custom FlowEdge component.
 * Renders edges using ELK's calculated sections/bendpoints, falling back to Bezier paths.
 */
function FlowEdge({
  style = {},
  markerEnd,
  data,
}: EdgeProps<AppFlowEdge>) {
  const sections = data?.sections;
  let path = '';

  if (sections && sections.length > 0) {
    path = sections
      .map((section: any) => {
        // Use ELK's EXACT mathematically calculated start, bend, and end points
        const points = [
          { x: section.startPoint.x, y: section.startPoint.y },
          ...(section.bendPoints || []).map((p: any) => ({ x: p.x, y: p.y })),
          { x: section.endPoint.x, y: section.endPoint.y },
        ];

        return getRoundedOrthogonalPath(points, 30);
      })
      .join(' ');
  }

  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}

export default memo(FlowEdge);
