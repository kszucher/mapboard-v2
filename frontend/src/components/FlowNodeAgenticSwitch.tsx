import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import type { Id } from '../../../convex/convex/_generated/dataModel';
import { SwitchBody } from './SwitchBody.tsx';
import type { AppFlowNode } from './types.ts';

interface FlowNodeAgenticSwitchProps {
  data: AppFlowNode['data'];
  updateNode: (args: { nodeId: Id<'nodes'>; patch: any }) => void;
  deleteEdgesByNodeAndHandles: (fromNodeId: Id<'nodes'>, deletedHandleIndex: number) => void;
}

export const FlowNodeAgenticSwitch = ({ data, updateNode, deleteEdgesByNodeAndHandles }: FlowNodeAgenticSwitchProps) => {
  const { node } = data;
  const SPACING = 40;
  const BASE_OFFSET = 66;
  const num = Math.max(1, node.numHandles || 0);
  const LEFT_HANDLE_OFFSET = BASE_OFFSET + ((num - 1) * SPACING) / 2;

  const branches = node.nodeTypeAgenticSwitchInput?.agenticExpressions ?? [];

  const handleBranchesChange = (newBranches: string[], deletedIndex?: number) => {
    if (deletedIndex !== undefined) {
      deleteEdgesByNodeAndHandles(node._id, deletedIndex);
    }

    updateNode({
      nodeId: node._id,
      patch: {
        nodeTypeAgenticSwitchInput: {
          ...node.nodeTypeAgenticSwitchInput,
          agenticExpressions: newBranches,
        },
        numHandles: newBranches.length,
      },
    });
  };

  return (
    <>
      <Flex direction="column" gap="3" style={{ marginTop: 38 }}>
        <SwitchBody branches={branches} onBranchesChange={handleBranchesChange} isLogicalSwitch={false} />
      </Flex>

      <Handle type="target" position={Position.Left} style={{ top: LEFT_HANDLE_OFFSET }} />

      {Array.from({ length: node.numHandles }).map((_, i) => (
        <Handle
          key={i}
          id={String(i)}
          type="source"
          position={Position.Right}
          style={{
            top: BASE_OFFSET + i * SPACING,
          }}
        />
      ))}
    </>
  );
};
