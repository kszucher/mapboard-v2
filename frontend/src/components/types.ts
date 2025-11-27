import type { Edge, Node } from '@xyflow/react';
import type { Doc } from '../../../convex/convex/_generated/dataModel';

export type AppFlowNode = Node<{ node: Doc<'nodes'> }, 'custom'>;
export type AppFlowEdge = Edge<{ edge: Doc<'edges'> }, 'custom'>;
