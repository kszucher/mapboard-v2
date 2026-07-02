import type { NodeChange, EdgeChange, Connection } from '@xyflow/react';
import type { components } from '../api/generated/schema';
import type { ApiExpression, AppFlowNode, AppFlowEdge, NodeType } from '../components/types';

export type GraphFlowRead = components['schemas']['GraphFlowRead'];

export interface GraphStoreState {
  graphId: string | null;
  nodes: AppFlowNode[];
  edges: AppFlowEdge[];
  expressions: ApiExpression[];
  past: Array<{ nodes: AppFlowNode[]; edges: AppFlowEdge[]; expressions: ApiExpression[] }>;
  future: Array<{ nodes: AppFlowNode[]; edges: AppFlowEdge[]; expressions: ApiExpression[] }>;
  isLoading: boolean;
  isSaving: boolean;

  init: (graphId: string) => Promise<void>;
  updateFromWebSocket: (flow: GraphFlowRead) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onEdgesDelete: (edgesToDelete: AppFlowEdge[]) => void;
  onReconnect: (oldEdge: AppFlowEdge, newConnection: Connection) => void;
  onNodeDragStop: () => void;

  addNode: (nodeType: NodeType) => Promise<void>;
  addConnectedNode: (expressionId: string, nodeType: NodeType) => Promise<void>;
  insertNodeBetween: (expressionId: string, nodeType: NodeType) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  shortcircuitNode: (nodeId: string) => Promise<void>;
  convertNode: (nodeId: string, targetType: NodeType) => Promise<void>;

  createExpression: (nodeId: string, type: string, idx: number) => Promise<void>;
  deleteExpression: (expressionId: string) => Promise<void>;
  updateExpression: (expressionId: string, raw_string: string) => void;
  swapExpressionIndices: (expressionId: string, direction: 'up' | 'down') => Promise<void>;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}
