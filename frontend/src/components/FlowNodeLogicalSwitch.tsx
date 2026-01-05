import { PlusIcon } from '@radix-ui/react-icons'
import { Flex, IconButton } from '@radix-ui/themes'
import { Handle, Position } from '@xyflow/react'
import { useCallback } from 'react'
import { useAppendExpression, useDeleteExpression, useUpdateExpression } from '../api/mutations'
import { BranchInput } from './BranchInput.tsx'
import type { AppFlowNode } from './types.ts'

interface FlowNodeLogicalSwitchProps {
  data: AppFlowNode['data'];
}

export const FlowNodeLogicalSwitch = ({ data }: FlowNodeLogicalSwitchProps) => {
  const appendExpression = useAppendExpression();
  const deleteExpression = useDeleteExpression();
  const updateExpression = useUpdateExpression();

  const { node } = data;
  const SPACING = 40;
  const BASE_OFFSET = 66;
  const expressions = node.expressions ?? [];
  const num = Math.max(1, expressions.length);
  const LEFT_HANDLE_OFFSET = BASE_OFFSET + ((num - 1) * SPACING) / 2;

  const branches = expressions.map(e => e.raw_string);

  const handleAddItem = useCallback(() => {
    appendExpression.mutate({ nodeId: node.id, rawString: '', graphId: node.graph_id });
  }, [appendExpression, node.id, node.graph_id]);

  const handleUpdateItem = useCallback(
    (index: number, newValue: string) => {
      const expr = expressions[index];
      if (expr) {
        updateExpression.mutate({
          expressionId: expr.id,
          patch: { raw_string: newValue },
          graphId: node.graph_id,
        });
      }
    },
    [expressions, updateExpression, node.graph_id]
  );

  const handleDeleteItem = useCallback(
    (index: number) => {
      const expr = expressions[index];
      if (expr) {
        deleteExpression.mutate({ expressionId: expr.id, graphId: node.graph_id });
      }
    },
    [expressions, deleteExpression, node.graph_id]
  );

  return (
    <>
      <Flex direction="column" gap="2" style={{ marginTop: 38, width: 'fit-content', minWidth: '100%' }}>
        {branches.length > 0 && (
          <Flex direction="column" gap="2" style={{ width: '100%' }}>
            {branches.map((branch, i) => (
              <BranchInput
                key={expressions[i].id}
                value={branch}
                onChange={(newValue) => handleUpdateItem(i, newValue)}
                onDelete={() => handleDeleteItem(i)}
                enableValidation={true}
              />
            ))}
          </Flex>
        )}

        <Flex gap="2" align="center" style={{ height: 32 }}>
          <IconButton onClick={handleAddItem} size="1" variant="ghost" color="gray">
            <PlusIcon />
          </IconButton>
        </Flex>
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
