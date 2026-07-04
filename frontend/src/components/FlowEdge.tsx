import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { memo } from 'react';
import { getRoundedOrthogonalPath } from './edgeUtils.ts';
import type { AppFlowEdge } from './types';

function FlowEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  data,
}: EdgeProps<AppFlowEdge>) {
  const sections = data?.sections;
  let path;

  console.log('render');

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
  return (
    prevProps.id === nextProps.id &&
    prevProps.sourceX === nextProps.sourceX &&
    prevProps.sourceY === nextProps.sourceY &&
    prevProps.targetX === nextProps.targetX &&
    prevProps.targetY === nextProps.targetY &&
    JSON.stringify(prevProps.markerEnd) === JSON.stringify(nextProps.markerEnd) &&
    JSON.stringify(prevProps.style) === JSON.stringify(nextProps.style) &&
    JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data)
  );
});
