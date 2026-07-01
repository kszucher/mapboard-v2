import type { Edge, Node } from '@xyflow/react';
import type { ElkEdgeSection } from 'elkjs';
import type { components } from '../api/generated/schema';

export type ApiNode = components['schemas']['NodeRead'];
export type ApiExpression = components['schemas']['ExpressionRead'];
export type NodeType = components['schemas']['NodeType'];
export type InsertableNodeType = Exclude<NodeType, 'START' | 'END'>;

export type AppFlowNode = Node<{
  node: ApiNode;
  expressions?: ApiExpression[];
  isPositioned?: boolean;
}, 'custom'>;

export const hasLeftHandle = (exprType: string): boolean => {
  return exprType === 'BASE_INPUT' || exprType === 'SUB_INPUT' || exprType === 'BASE_INPUT_OUTPUT';
};

export const hasRightHandle = (exprType: string): boolean => {
  return exprType === 'BASE_OUTPUT' || exprType === 'SUB_OUTPUT' || exprType === 'BASE_INPUT_OUTPUT';
};

export const hasExpressionActions = (exprType: string, nodeType: string): boolean => {
  const isSub = exprType.startsWith('SUB_');
  const isEnd = nodeType === 'END';
  const rightHandle = hasRightHandle(exprType);
  return isSub || (rightHandle && !isEnd);
};

export type AppFlowEdge = Edge<{
  sections?: ElkEdgeSection[];
}, 'custom'>;
