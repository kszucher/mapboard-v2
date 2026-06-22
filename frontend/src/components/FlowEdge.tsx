import { BaseEdge, type EdgeProps, getBezierPath, useEdges, useNodes } from '@xyflow/react';
import { memo } from 'react';
import { checkIsBackEdge, getDynamicLayers, getBacklinkPath } from './shared/edgeUtils';
import type { AppFlowEdge, AppFlowNode } from './types';

/**
 * Custom FlowEdge component.
 * Renders forward edges as bezier curves and backward edges (feedback loops) as perimeter detour lanes.
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
}: EdgeProps<AppFlowEdge>) {
  const allNodes = useNodes();
  const allEdges = useEdges();

  const sourceNode = allNodes.find((n) => n.id === source) as AppFlowNode | undefined;
  const targetNode = allNodes.find((n) => n.id === target) as AppFlowNode | undefined;

  const layerMap = getDynamicLayers(allNodes as AppFlowNode[], allEdges as AppFlowEdge[]);
  const isBackEdge = checkIsBackEdge(sourceNode, targetNode, layerMap, sourceX, targetX);

  const getPath = (): string => {
    if (isBackEdge) {
      return getBacklinkPath(
        id,
        source,
        target,
        sourceX,
        sourceY,
        targetX,
        targetY,
        allNodes as AppFlowNode[],
        allEdges as AppFlowEdge[],
        layerMap
      );
    }
    const [bezierPath] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
    return bezierPath;
  };

  const path = getPath();

  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}

export default memo(FlowEdge);
