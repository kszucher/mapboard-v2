import type { Edge, Node } from '@xyflow/react';
import type { components } from '../api/generated/schema';

export type ApiNode = components['schemas']['NodeRead'];
export type ApiEdge = components['schemas']['EdgeRead'];
export type ApiExpression = components['schemas']['ExpressionRead'];

export interface EdgeRoutingData {
  type: 'forward' | 'back';
  laneIndex: number;
  corridor: 'right' | 'bottom';
  priorityIndex: number;
  hull: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
}

export type AppFlowNode = Node<{ node: ApiNode; layer?: number }, 'custom'>;
export type AppFlowEdge = Edge<{ edge?: ApiEdge; sections?: any[]; routing?: EdgeRoutingData }, 'custom'>;

