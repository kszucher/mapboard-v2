import type { Connection, EdgeChange, NodeChange } from '@xyflow/react';
import type { components } from '../api/generated/schema';
import type { ApiExpression, AppFlowEdge, AppFlowNode, NodeType } from '../components/types';

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

export interface InitSlice {
  init: (graphId: string) => Promise<void>;
  updateFromWebSocket: (flow: GraphFlowRead) => void;
}

export interface FlowSlice {
  onConnect: (connection: Connection) => Promise<void>;
  onEdgesDelete: (edgesToDelete: AppFlowEdge[]) => Promise<void>;
  onReconnect: (oldEdge: AppFlowEdge, newConnection: Connection) => Promise<void>;
}

export interface NodeSlice {
  addNode: (nodeType: NodeType) => Promise<void>;
  addConnectedNode: (expressionId: string, nodeType: NodeType) => Promise<void>;
  insertNodeBetween: (expressionId: string, nodeType: NodeType) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  shortcircuitNode: (nodeId: string) => Promise<void>;
  convertNode: (nodeId: string, targetType: NodeType) => Promise<void>;
}

export interface ExpressionSlice {
  createExpression: (nodeId: string, isInput: boolean, isOutput: boolean, idx: number) => Promise<void>;
  deleteExpression: (expressionId: string) => Promise<void>;
  updateExpression: (expressionId: string, updates: {
    raw_string?: string;
    is_input?: boolean;
    is_output?: boolean
  }) => Promise<void>;
  swapExpressionIndices: (expressionId: string, direction: 'up' | 'down') => Promise<void>;
}

export interface HistorySlice {
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export type GraphStoreState = BaseState &
  InitSlice &
  FlowSlice &
  NodeSlice &
  ExpressionSlice &
  HistorySlice;
