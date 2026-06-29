import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { memo } from 'react';
import { getRoundedOrthogonalPath } from './edgeUtils.ts';
import type { AppFlowEdge } from './types';

function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  data,
}: EdgeProps<AppFlowEdge>) {
  console.log('Rendering edge:', id);
  const sections = data?.sections;
  let path;

  if (sections && sections.length > 0) {
    path = sections
      .map((section) => {
        const start = section.startPoint;
        const end = section.endPoint;
        const bends = section.bendPoints ?? [];

        const points = [
          { x: start.x, y: start.y },
          ...bends.map((p) => ({ x: p.x, y: p.y })),
          { x: end.x, y: end.y },
        ];

        return getRoundedOrthogonalPath(points, 30);
      })
      .join(' ');
  } else {
    // Fallback to React Flow anchors if ELK produced no sections
    path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  }

  return <BaseEdge path={path} markerEnd={markerEnd} style={style}/>;
}

export default memo(FlowEdge, (prevProps, nextProps) => {
  if (prevProps.id !== nextProps.id) return false;
  if (prevProps.sourceX !== nextProps.sourceX) return false;
  if (prevProps.sourceY !== nextProps.sourceY) return false;
  if (prevProps.targetX !== nextProps.targetX) return false;
  if (prevProps.targetY !== nextProps.targetY) return false;
  if (prevProps.markerEnd !== nextProps.markerEnd) return false;

  const prevStyle = prevProps.style || {};
  const nextStyle = nextProps.style || {};
  if (
    prevStyle.stroke !== nextStyle.stroke ||
    prevStyle.strokeWidth !== nextStyle.strokeWidth ||
    prevStyle.opacity !== nextStyle.opacity
  ) {
    return false;
  }

  const prevSections = prevProps.data?.sections || [];
  const nextSections = nextProps.data?.sections || [];
  if (prevSections.length !== nextSections.length) return false;
  for (let i = 0; i < prevSections.length; i++) {
    const pSec = prevSections[i];
    const nSec = nextSections[i];
    if (
      pSec.startPoint.x !== nSec.startPoint.x ||
      pSec.startPoint.y !== nSec.startPoint.y ||
      pSec.endPoint.x !== nSec.endPoint.x ||
      pSec.endPoint.y !== nSec.endPoint.y
    ) {
      return false;
    }
  }

  return true;
});
