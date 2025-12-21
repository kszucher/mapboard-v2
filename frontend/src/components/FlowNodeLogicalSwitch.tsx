import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { useDeleteEdgesByNodeAndHandles, useUpdateNode } from '../api/mutations';
import { BranchInput } from './BranchInput.tsx';
import { EditableList } from './shared/EditableList.tsx';
import type { AppFlowNode } from './types.ts';

interface FlowNodeLogicalSwitchProps {
  data: AppFlowNode['data'];
}

export const FlowNodeLogicalSwitch = ({ data }: FlowNodeLogicalSwitchProps) => {
  const updateNodeMutation = useUpdateNode();
  const deleteEdgesByNodeAndHandlesMutation = useDeleteEdgesByNodeAndHandles();
  const { node } = data;
  const SPACING = 40;
  const BASE_OFFSET = 66;
  const num = Math.max(1, node.expressions?.length || 0);
  const LEFT_HANDLE_OFFSET = BASE_OFFSET + ((num - 1) * SPACING) / 2;

  const branches = node.expressions?.map(e => e.raw_string) ?? [];

  const handleBranchesChange = (newBranches: string[], deletedIndex?: number) => {
    if (deletedIndex !== undefined) {
      deleteEdgesByNodeAndHandlesMutation.mutate({ fromNodeId: node.id, deletedHandleIndex: deletedIndex });
    }

    updateNodeMutation.mutate({
      nodeId: node.id,
      patch: {
        graph_id: node.graph_id,
        expressions: newBranches.map((raw_string, idx) => ({ idx, raw_string })),
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

      {Array.from({ length: node.expressions?.length || 0 }).map((_, i) => (
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
