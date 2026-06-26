import type { Edge, Node } from '@xyflow/react';
import type { components } from '../api/generated/schema';

export type ApiNode = components['schemas']['NodeRead'];
export type ApiEdge = components['schemas']['EdgeRead'];
export type ApiExpression = components['schemas']['ExpressionRead'];

export type AppFlowNode = Node<{ node: ApiNode; layer?: number; expressions?: ApiExpression[] }, 'custom'>;
export type AppFlowEdge = Edge<{ edge?: ApiEdge; isBack?: boolean }, 'custom'>;
