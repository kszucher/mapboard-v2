import type { EdgeChange } from '@xyflow/react';
import type { AppFlowEdge, AppFlowNode } from '../canvas/types';

export interface BaseState {
  graphId: string | null;
  code: string; // local code buffer for CodeMirror
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
}

export interface UiActions {
  setSelectedNodeId: (nodeId: string | null) => void;
  setSelectedEdgeId: (edgeId: string | null) => void;
  handleEdgesChange: (changes: EdgeChange[]) => void;
  clearSelection: () => void;
  reconcileSelection: (newNodes: AppFlowNode[]) => void;
  selectSiblingNode: (
    direction: 'above' | 'below',
    nodes: AppFlowNode[],
    edges: AppFlowEdge[]
  ) => void;
  selectTraversalNode: (
    direction: 'left' | 'right',
    nodes: AppFlowNode[],
    edges: AppFlowEdge[]
  ) => void;
  init: (graphId: string) => void;
}

export type GraphStoreState = BaseState & UiActions;
