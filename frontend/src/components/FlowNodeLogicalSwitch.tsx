import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import {
  useCreateExpression,
  useUpdateExpression,
  useDeleteExpression
} from '../api/mutations';
import { BranchInput } from './BranchInput.tsx';
import { EditableList } from './shared/EditableList.tsx';
import type { AppFlowNode } from './types.ts';

interface FlowNodeLogicalSwitchProps {
  data: AppFlowNode['data'];
}

export const FlowNodeLogicalSwitch = ({ data }: FlowNodeLogicalSwitchProps) => {
  const createExpressionMutation = useCreateExpression();
  const updateExpressionMutation = useUpdateExpression();
  const deleteExpressionMutation = useDeleteExpression();

  const { node } = data;
  const SPACING = 40;
  const BASE_OFFSET = 66;
  const expressions = node.expressions ?? [];
  const num = Math.max(1, expressions.length);
  const LEFT_HANDLE_OFFSET = BASE_OFFSET + ((num - 1) * SPACING) / 2;

  const branches = expressions.map(e => e.raw_string);

  const handleBranchesChange = (newBranches: string[], deletedIndex?: number) => {
    const graphId = node.graph_id;

    // 1. Handle Deletion
    if (deletedIndex !== undefined) {
      const deletedExpr = expressions[deletedIndex];
      if (deletedExpr) {
        deleteExpressionMutation.mutate({ expressionId: deletedExpr.id, graphId });

        // After deletion, we need to update indices of subsequent expressions
        expressions.slice(deletedIndex + 1).forEach((expr, i) => {
          updateExpressionMutation.mutate({
            expressionId: expr.id,
            graphId,
            patch: { idx: deletedIndex + i }
          });
        });
      }
      return;
    }

    // 2. Handle Addition
    if (newBranches.length > expressions.length) {
      const lastIdx = newBranches.length - 1;
      const raw_string = newBranches[lastIdx];
      createExpressionMutation.mutate({
        nodeId: node.id,
        idx: lastIdx,
        raw_string,
        graphId,
      });
      return;
    }

    // 3. Handle Update (Only if lengths match to avoid race conditions during deletion)
    if (newBranches.length === expressions.length) {
      newBranches.forEach((raw_string, idx) => {
        const expr = expressions[idx];
        if (expr && expr.raw_string !== raw_string) {
          updateExpressionMutation.mutate({
            expressionId: expr.id,
            patch: { raw_string },
            graphId,
          });
        }
      });
    }
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

      {expressions.map((expr, i) => (
        <Handle
          key={expr.id}
          id={expr.id}
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
