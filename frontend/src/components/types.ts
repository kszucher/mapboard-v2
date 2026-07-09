import type { Edge, Node } from '@xyflow/react';
import type { ElkEdgeSection } from 'elkjs';
import type { components } from '../api/generated/schema';

export type ApiNode = components['schemas']['NodeRead'] & {
  traversalIndex?: number;
};
export type ApiSlot = components['schemas']['SlotRead'];
export type NodeType = components['schemas']['NodeType'];
export type InsertableNodeType = Exclude<NodeType, 'START' | 'END'>;

export type Variable = components['schemas']['VariableRead'];
export type FunctionEntity = components['schemas']['FunctionRead'];

export type AppFlowNode = Node<{
  node: ApiNode;
}, 'custom'>;


export type AppFlowEdge = Edge<{
  sections?: ElkEdgeSection[];
}, 'custom'>;
