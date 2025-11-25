import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import type { Doc } from '../../../convex-shared/convex/_generated/dataModel';

type Tool = Doc<'tools'>;
type BackendNode = Doc<'nodes'>;
type BackendEdge = Doc<'edges'>;

export type AppFlowNode = FlowNode<{ node: BackendNode; tool: Tool }, 'custom'>;
export type AppFlowEdge = FlowEdge<{ edge: BackendEdge }, 'custom'>;
