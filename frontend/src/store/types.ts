import type { EdgeChange, NodeChange } from '@xyflow/react';
import type { ApiExpression, AppFlowEdge, AppFlowNode } from '../components/types';
import type { components } from '../api/generated/schema';
import type { InitSlice } from './slices/initSlice';
import type { FlowSlice } from './slices/flowSlice';
import type { NodeSlice } from './slices/nodeSlice';
import type { ExpressionSlice } from './slices/expressionSlice';
import type { HistorySlice } from './slices/historySlice';

export type GraphFlowRead = components['schemas']['GraphFlowRead'];

export interface BaseState {
  graphId: string | null;
  nodes: AppFlowNode[];
  edges: AppFlowEdge[];
  expressions: ApiExpression[];
  past: Array<{ nodes: AppFlowNode[]; edges: AppFlowEdge[]; expressions: ApiExpression[] }>;
  future: Array<{ nodes: AppFlowNode[]; edges: AppFlowEdge[]; expressions: ApiExpression[] }>;
  isLoading: boolean;
  isSaving: boolean;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onNodeDragStop: () => void;
}

export type GraphStoreState = BaseState &
  InitSlice &
  FlowSlice &
  NodeSlice &
  ExpressionSlice &
  HistorySlice;
