import { BaseEdge, type EdgeProps, getBezierPath, useEdges, useNodes } from '@xyflow/react';
import { memo } from 'react';
import { getBacklinkPath } from './shared/edgeUtils';
import type { AppFlowEdge, AppFlowNode } from './types';

/**
 * Custom FlowEdge component.
 * Renders forward edges as bezier curves and backward edges (feedback loops) as perimeter detour lanes.
 * isBack is pre-computed in Flow.tsx and stored on edge.data to avoid redundant graph traversal here.
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
  const allNodes = useNodes();
  const allEdges = useEdges();

  const isBackEdge = data?.isBack ?? false;

  const path = isBackEdge
    ? getBacklinkPath(id, source, target, sourceX, sourceY, targetX, targetY, allNodes as AppFlowNode[], allEdges as AppFlowEdge[])
    : getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })[0];

  return <BaseEdge path={path} markerEnd={markerEnd} style={style}/>;
}

export default memo(FlowEdge);
