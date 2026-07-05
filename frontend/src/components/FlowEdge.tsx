import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { memo, useEffect, useRef } from 'react';
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
  const sections = data?.sections;
  let path;

  // Log on every render execution to trace render triggers
  console.log(`[Edge Render] ID: ${id} render call`, {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sectionsCount: sections?.length ?? 0
  });

  const lastPropsRef = useRef({ sourceX, sourceY, targetX, targetY });

  // Log precise delta changes when coordinate values shift
  useEffect(() => {
    const prev = lastPropsRef.current;
    const dxSource = sourceX - prev.sourceX;
    const dySource = sourceY - prev.sourceY;
    const dxTarget = targetX - prev.targetX;
    const dyTarget = targetY - prev.targetY;

    if (dxSource !== 0 || dySource !== 0 || dxTarget !== 0 || dyTarget !== 0) {
      console.log(`[Edge Debug] ID: ${id} coordinates changed!`, {
        sourceDiff: { dx: dxSource, dy: dySource },
        targetDiff: { dx: dxTarget, dy: dyTarget },
        current: { sourceX, sourceY, targetX, targetY },
        previous: prev,
      });
    }

    lastPropsRef.current = { sourceX, sourceY, targetX, targetY };
  }, [id, sourceX, sourceY, targetX, targetY]);

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

  // Calculate presentation styles dynamically based on edge flow geometry
  const isBack = targetX <= sourceX;
  const edgeStyle = {
    ...style,
    stroke: isBack ? '#ff9800' : '#888888',
    strokeWidth: 2,
    opacity: 1,
    transition: 'opacity 0.2s ease-in-out',
  };

  return <BaseEdge path={path} markerEnd={markerEnd} style={edgeStyle}/>;
}

export default memo(FlowEdge, (prevProps, nextProps) => {
  return (
    prevProps.id === nextProps.id &&
    prevProps.sourceX === nextProps.sourceX &&
    prevProps.sourceY === nextProps.sourceY &&
    prevProps.targetX === nextProps.targetX &&
    prevProps.targetY === nextProps.targetY &&
    JSON.stringify(prevProps.markerEnd) === JSON.stringify(nextProps.markerEnd) &&
    JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data)
  );
});
