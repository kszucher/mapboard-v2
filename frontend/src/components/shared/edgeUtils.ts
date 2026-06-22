/**
 * Edge Classification Utilities for Agentic AI Workflow Visualization
 * 
 * Separates the classification of forward (pipeline flow) and backward (feedback loop) edges.
 * By identifying loop structures based on layers and coordinates, we can isolate them from the 
 * main layout calculations and apply specific perimeter routing to improve workflow readability.
 */
import type { AppFlowNode } from '../types';

/**
 * Extracts the layer number from a node data structure.
 */
export const getLayer = (node: AppFlowNode | undefined): number | undefined => {
  if (!node) return undefined;
  const nodeData = node.data as Record<string, unknown> | undefined;
  const innerNode = nodeData?.node as Record<string, unknown> | undefined;
  const val = nodeData?.layer ?? innerNode?.layer ?? (node as unknown as Record<string, unknown>)?.layer;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

/**
 * Determines whether an edge is a backward edge.
 * Supports passing handle X coordinates directly (for runtime rendering offsets) or node positions (for layout).
 */
export const checkIsBackEdge = (
  sourceNode: AppFlowNode | undefined,
  targetNode: AppFlowNode | undefined,
  sourceX?: number,
  targetX?: number
): boolean => {
  if (!sourceNode || !targetNode) return false;

  const sourceLayer = getLayer(sourceNode);
  const targetLayer = getLayer(targetNode);

  const sX = sourceX ?? sourceNode.position.x;
  const tX = targetX ?? targetNode.position.x;

  return sourceLayer !== undefined && targetLayer !== undefined
    ? sX > tX || sourceLayer > targetLayer
    : sX > tX;
};
