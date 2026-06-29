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
}, 'custom'>;

export type AppFlowEdge = Edge<{
  sections?: ElkEdgeSection[];
}, 'custom'>;
