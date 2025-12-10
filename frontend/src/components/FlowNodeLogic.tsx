import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { useGraphMutationsContext } from './contexts/GraphMutationsContext.tsx';
import { FlowNodeLogicBody } from './FlowNodeLogicBody.tsx';
import type { AppFlowNode } from './types.ts';

interface FlowNodeLogicProps {
  data: AppFlowNode['data'];
}

export const FlowNodeLogic = ({ data }: FlowNodeLogicProps) => {
  const { updateNode } = useGraphMutationsContext();
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
        <FlowNodeLogicBody assignments={assignments} onAssignmentsChange={handleAssignmentsChange} />
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
