import type { Connection, EdgeChange, NodeChange } from '@xyflow/react';
import type { components } from '../api/generated/schema';
import type { AppFlowEdge, AppFlowNode, FunctionEntity, NodeType, Variable } from '../components/types';

export type GraphFlowRead = components['schemas']['GraphFlowRead'];

export interface BaseState {
  graphId: string | null;
  code: string;
  nodes: AppFlowNode[];
  edges: AppFlowEdge[];
  variables: Variable[];
  functions: FunctionEntity[];
  past: Array<{
    code: string;
    nodes: AppFlowNode[];
    edges: AppFlowEdge[];
    variables: Variable[];
    functions: FunctionEntity[]
  }>;
  future: Array<{
    code: string;
    nodes: AppFlowNode[];
    edges: AppFlowEdge[];
    variables: Variable[];
    functions: FunctionEntity[]
  }>;
  isLoading: boolean;
  isSaving: boolean;
  errorMessage: string | null;
  clearErrorMessage: () => void;
  pendingLayoutNodeId: string | null;
  selectedNodeId: string | null;
  selectedSlotId: string | null;
}

export interface InitSlice {
  init: (graphId: string) => Promise<void>;
}

export interface FlowSlice {
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => Promise<void>;
  onEdgesDelete: (edgesToDelete: AppFlowEdge[]) => Promise<void>;
  onReconnect: (oldEdge: AppFlowEdge, newConnection: Connection) => Promise<void>;
}

export interface NodeSlice {
  addNode: (nodeType: NodeType) => Promise<void>;
  insertNode: (connectorId: string, nodeType: NodeType, direction: 'before' | 'after') => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  shortcircuitNode: (nodeId: string) => Promise<void>;
  convertNode: (nodeId: string, targetType: NodeType) => Promise<void>;
  deleteEdge: (edgeId: string) => Promise<void>;
  updateNode: (nodeId: string, updates: {
    is_input?: boolean;
    is_output?: boolean;
    code?: string | null;
    selected?: boolean;
  }) => Promise<void>;
  setSelectedIds: (nodeId: string | null, branchIndex: number | null) => Promise<void>;
}

export interface SlotSlice {
  createSlot: (nodeId: string, idx: number) => Promise<void>;
  deleteSlot: (slotId: string) => Promise<void>;
  updateSlot: (slotId: string, updates: {
    raw_string?: string;
    selected?: boolean;
  }) => Promise<void>;
  moveSlot: (slotId: string, direction: 'up' | 'down' | 'top' | 'bottom') => Promise<void>;
  clearSlotSelection: () => Promise<void>;
}

export interface ExecutionSlice {
  updateCode: (code: string) => Promise<void>;
  runGraph: () => Promise<void>;
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
  SlotSlice &
  ExecutionSlice &
  HistorySlice;
