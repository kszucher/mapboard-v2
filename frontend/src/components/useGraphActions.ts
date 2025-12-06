import { useMutation } from 'convex/react';
import { useCallback } from 'react';
import { api } from '../../../convex/convex/_generated/api';
import type { Id } from '../../../convex/convex/_generated/dataModel';
import { Color, NodeType } from '../../../convex/convex/schema.ts';

export const useGraphActions = () => {
  const createNodeMutation = useMutation(api.nodes.createNode);
  const updateNodeMutation = useMutation(api.nodes.updateNode);
  const createEdgeMutation = useMutation(api.edges.createEdge);
  const deleteEdgeMutation = useMutation(api.edges.deleteEdge);

  const createNode = useCallback(
    (graphId: Id<'graphs'>, nodeType: NodeType) => {
      void createNodeMutation({
        graphId,
        iid: 1,
        width: 200,
        height: 120,
        offsetX: 0,
        offsetY: 50,
        color: {
          [NodeType.START]: Color.gray,
          [NodeType.LOGIC]: Color.purple,
          [NodeType.AGENT]: Color.blue,
          [NodeType.LOGICAL_SWITCH]: Color.amber,
          [NodeType.AGENTIC_SWITCH]: Color.grass,
        }[nodeType],
        label: {
          [NodeType.START]: 'Start',
          [NodeType.LOGIC]: 'Logic',
          [NodeType.AGENT]: 'Agent',
          [NodeType.LOGICAL_SWITCH]: 'Logical Switch',
          [NodeType.AGENTIC_SWITCH]: 'Agentic Switch',
        }[nodeType],
        numHandles: 1,
        nodeType: nodeType,
        isProcessing: false,
        inputValue: null,
        outputValue: null,
        inputSchema: null,
        outputSchema: null,
      });
    },
    [createNodeMutation]
  );

  const updateNodePosition = useCallback(
    (nodeId: Id<'nodes'>, x: number, y: number) => {
      void updateNodeMutation({
        nodeId,
        patch: {
          offsetX: Math.round(x),
          offsetY: Math.round(y),
        },
      });
    },
    [updateNodeMutation]
  );

  const createEdge = useCallback(
    (graphId: Id<'graphs'>, fromNodeId: Id<'nodes'>, toNodeId: Id<'nodes'>, handleIndex: number) => {
      void createEdgeMutation({
        graphId,
        fromNodeId,
        toNodeId,
        handleIndex,
      });
    },
    [createEdgeMutation]
  );

  const deleteEdge = useCallback(
    (edgeId: Id<'edges'>) => {
      void deleteEdgeMutation({ edgeId });
    },
    [deleteEdgeMutation]
  );

  return {
    createNode,
    updateNodePosition,
    createEdge,
    deleteEdge,
  };
};
