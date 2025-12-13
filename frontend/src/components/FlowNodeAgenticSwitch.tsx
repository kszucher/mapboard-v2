import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { BranchInput } from './BranchInput.tsx';
import { useGraphMutationsContext } from './contexts/GraphMutationsContext.tsx';
import { EditableList } from './shared/EditableList.tsx';
import type { AppFlowNode } from './types.ts';

interface FlowNodeAgenticSwitchProps {
  data: AppFlowNode['data'];
}

export const FlowNodeAgenticSwitch = ({ data }: FlowNodeAgenticSwitchProps) => {
  const { updateNode, deleteEdgesByNodeAndHandles } = useGraphMutationsContext();
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
        <EditableList<string>
          items={branches}
          onItemsChange={handleBranchesChange}
          createNewItem={() => ''}
          renderItem={(branch, index, { onUpdate, onDelete }) => (
            <BranchInput
              key={index}
              value={branch}
              onChange={onUpdate}
              onDelete={onDelete}
              enableValidation={true}
            />
          )}
        />
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
