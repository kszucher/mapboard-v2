import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import type { Id } from '../../../convex/convex/_generated/dataModel';
import { LogicAssignmentsBody } from './LogicAssignmentsBody.tsx';
import type { AppFlowNode } from './types.ts';

interface FlowNodeLogicProps {
  data: AppFlowNode['data'];
  updateNode: (args: { nodeId: Id<'nodes'>; patch: any }) => void;
}

export const FlowNodeLogic = ({ data, updateNode }: FlowNodeLogicProps) => {
  const { node } = data;

  const assignments = node.nodeTypeLogicInput?.logicalAssignments ?? [];

  const handleAssignmentsChange = (newAssignments: string[]) => {
    updateNode({
      nodeId: node._id,
      patch: {
        nodeTypeLogicInput: {
          logicalAssignments: newAssignments,
        },
        // Don't update numHandles - it's independent for Logic nodes
      },
    });
  };

  return (
    <>
      <Flex direction="column" gap="3" style={{ marginTop: 38 }}>
        <LogicAssignmentsBody assignments={assignments} onAssignmentsChange={handleAssignmentsChange} />
      </Flex>

      <Handle type="target" position={Position.Left} />

      <Handle
        id="0"
        type="source"
        position={Position.Right}
      />
    </>
  );
};
