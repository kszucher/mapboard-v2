import type { Edge, Node } from '@xyflow/react';
import type { ElkEdgeSection } from 'elkjs';
import type { components } from '../api/generated/schema';

export type ApiNode = components['schemas']['NodeRead'];
export type ApiEdge = components['schemas']['EdgeRead'];
export type ApiExpression = components['schemas']['ExpressionRead'];
export type NodeType = components['schemas']['NodeType'];
export type InsertableNodeType = Exclude<NodeType, 'START' | 'END'>;

export type AppFlowNode = Node<{
  node: ApiNode;
  layer?: number;
  visitOrder?: number;
  expressions?: ApiExpression[];
  isLayoutReady?: boolean;
}, 'custom'>;

export type AppFlowEdge = Edge<{
  edge?: ApiEdge;
  isBack?: boolean;
  track?: number;
  sections?: ElkEdgeSection[];
}, 'custom'>;
