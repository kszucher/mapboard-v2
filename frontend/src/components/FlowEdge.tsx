import { BaseEdge, type EdgeProps, getBezierPath, useEdges, useNodes } from '@xyflow/react'
import { memo } from 'react'
import { assignBackLinkTracks, checkIsBackEdge, getDynamicLayers } from './shared/edgeUtils'
import type { AppFlowEdge, AppFlowNode } from './types'

// Helper to construct an SVG path string from orthogonal points with rounded corners
function getRoundedOrthogonalPath(points: { x: number; y: number }[], radius = 20) {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }

  let path = `M ${points[0].x} ${points[0].y}`

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]

    // Vector from prev to curr
    const dx1 = curr.x - prev.x
    const dy1 = curr.y - prev.y
    const len1 = Math.hypot(dx1, dy1)

    // Vector from curr to next
    const dx2 = next.x - curr.x
    const dy2 = next.y - curr.y
    const len2 = Math.hypot(dx2, dy2)

    // Ensure the radius doesn't exceed half the segment lengths
    const r = Math.min(radius, len1 / 2, len2 / 2)

    if (r > 0) {
      const p1x = curr.x - (dx1 / len1) * r
      const p1y = curr.y - (dy1 / len1) * r
      const p2x = curr.x + (dx2 / len2) * r
      const p2y = curr.y + (dy2 / len2) * r

      path += ` L ${p1x} ${p1y} Q ${curr.x} ${curr.y} ${p2x} ${p2y}`
    } else {
      path += ` L ${curr.x} ${curr.y}`
    }
  }

  const last = points[points.length - 1]
  path += ` L ${last.x} ${last.y}`
  return path
}


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
                    markerEnd
                  }: EdgeProps<AppFlowEdge>) {
  const allNodes = useNodes()
  const allEdges = useEdges()

  const sourceNode = allNodes.find((n) => n.id === source) as AppFlowNode | undefined
  const targetNode = allNodes.find((n) => n.id === target) as AppFlowNode | undefined

  const layerMap = getDynamicLayers(allNodes as AppFlowNode[], allEdges as AppFlowEdge[])

  // Stronger semantic rule: sourceLayer > targetLayer OR sourceX > targetX
  const isBackEdge = checkIsBackEdge(sourceNode, targetNode, layerMap, sourceX, targetX)


  const getPath = (): string => {
    if (isBackEdge) {
      // ROUTE: BACKEDGE PERIMETER PATH
      const trackMap = assignBackLinkTracks(
        allEdges as AppFlowEdge[],
        allNodes as AppFlowNode[],
        layerMap
      )
      const track = trackMap.get(id) ?? 0

      // 1. Pre-map nodes for O(1) lookups
      const nodesMap = new Map<string, AppFlowNode>()
      for (const node of allNodes) {
        nodesMap.set(node.id, node as AppFlowNode)
      }

      // 2. Identify the source/target nodes and their layer indices
      const sourceNodeObj = nodesMap.get(source)
      const targetNodeObj = nodesMap.get(target)
      const sLayer = sourceNodeObj ? layerMap.get(sourceNodeObj.id) : undefined
      const tLayer = targetNodeObj ? layerMap.get(targetNodeObj.id) : undefined

      // 3. Identify all nodes in the same layer/column as the source node
      const sameColumnNodes = allNodes.filter((n) => {
        const nLayer = layerMap.get(n.id);
        return sLayer !== undefined && nLayer !== undefined && sLayer === nLayer;
      });

      // 4. Find the max right edge position among all nodes in this column
      const maxRight = sameColumnNodes.reduce((max, n) => {
        const width = n.measured?.width ?? n.width ?? 200
        const rightEdge = n.position.x + width
        return rightEdge > max ? rightEdge : max
      }, -Infinity)

      // 5. Gather and filter all backedges using nodesMap
      const allBackEdges: { edge: AppFlowEdge; sNode: AppFlowNode; tNode: AppFlowNode }[] = []
      for (const e of allEdges) {
        const sNode = nodesMap.get(e.source)
        const tNode = nodesMap.get(e.target)
        if (sNode && tNode) {
          const isBack = checkIsBackEdge(sNode, tNode, layerMap)
          if (isBack) {
            allBackEdges.push({ edge: e as AppFlowEdge, sNode, tNode })
          }
        }
      }

      // 6. Find all backedges originating from this column and calculate Local Source Sub-Lane
      const columnBackEdges = allBackEdges.filter((x) => {
        const nLayer = layerMap.get(x.sNode.id);
        return sLayer !== undefined && nLayer !== undefined && sLayer === nLayer;
      });

      const sortedSourceEdges = [...columnBackEdges].sort((a, b) => {
        const trackA = trackMap.get(a.edge.id) ?? 0
        const trackB = trackMap.get(b.edge.id) ?? 0
        return trackA - trackB
      })
      const activeSourceSubLane = sortedSourceEdges.findIndex((x) => x.edge.id === id)
      const activeSourceSubLaneIndex = activeSourceSubLane !== -1 ? activeSourceSubLane : 0

      // 7. Find all backedges targeting this column and calculate Local Target Sub-Lane
      const targetColumnBackEdges = allBackEdges.filter((x) => {
        const nLayer = layerMap.get(x.tNode.id);
        return tLayer !== undefined && nLayer !== undefined && tLayer === nLayer;
      });

      const sortedTargetEdges = [...targetColumnBackEdges].sort((a, b) => {
        const trackA = trackMap.get(a.edge.id) ?? 0
        const trackB = trackMap.get(b.edge.id) ?? 0
        return trackA - trackB
      })
      const activeTargetSubLane = sortedTargetEdges.findIndex((x) => x.edge.id === id)
      const activeTargetSubLaneIndex = activeTargetSubLane !== -1 ? activeTargetSubLane : 0

      // 7. Calculate local hull bottom of all columns <= sLayer (hull per layer)
      const localNodes = allNodes.filter((n) => {
        const nLayer = layerMap.get(n.id)
        return nLayer !== undefined && sLayer !== undefined && nLayer <= sLayer
      })
      const localMaxY = localNodes.reduce((max, n) => {
        const height = n.measured?.height ?? n.height ?? 120
        const bottomEdge = n.position.y + height
        return bottomEdge > max ? bottomEdge : max
      }, -Infinity)
      const localBottom = localMaxY === -Infinity ? 500 : localMaxY

      // 8. Calculate parallel path offsets
      const bottomLaneY = localBottom + 80 + track * 20
      const localRightX = (maxRight === -Infinity ? sourceX : maxRight) + 40 + activeSourceSubLaneIndex * 10
      const targetApproachX = targetX - (35 + activeTargetSubLaneIndex * 10)

      const points = [
        { x: sourceX, y: sourceY },
        { x: localRightX, y: sourceY },
        { x: localRightX, y: bottomLaneY },
        { x: targetApproachX, y: bottomLaneY },
        { x: targetApproachX, y: targetY },
        { x: targetX, y: targetY },
      ]

      return getRoundedOrthogonalPath(points, 20)
    } else {
      // Generate bezier curve path for forward edges
      const [bezierPath] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      })
      return bezierPath
    }
  }

  const path = getPath()

  return (
    <BaseEdge
      path={path}
      markerEnd={markerEnd}
      style={style}
    />
  )
}

export default memo(FlowEdge)

