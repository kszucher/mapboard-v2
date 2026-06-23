import { PlusIcon } from '@radix-ui/react-icons'
import { Flex, IconButton } from '@radix-ui/themes'
import { Handle, Position } from '@xyflow/react'
import { useCallback, useMemo } from 'react'
import {
  useCreateExpression,
  useDeleteExpression,
  useUpdateExpression,
  useMoveExpressionUp,
  useMoveExpressionDown,
} from '../api/mutations'
import { useExpressions } from '../api/queries'
import { BranchInput } from './BranchInput.tsx'
import type { AppFlowNode } from './types.ts'

interface FlowNodeLogicalSwitchProps {
  data: AppFlowNode['data'];
}

export const FlowNodeLogicalSwitch = ({ data }: FlowNodeLogicalSwitchProps) => {
  const createExpression = useCreateExpression();
  const deleteExpression = useDeleteExpression();
  const updateExpression = useUpdateExpression();
  const moveExpressionUp = useMoveExpressionUp();
  const moveExpressionDown = useMoveExpressionDown();

  const { node } = data;
  const { data: allExpressions } = useExpressions(node.graph_id);

  const expressions = useMemo(() => {
    const filtered = allExpressions?.filter(e => e.node_id === node.id) ?? [];
    return [...filtered].sort((a, b) => a.idx - b.idx);
  }, [allExpressions, node.id]);

  const SPACING = 32;
  const BASE_OFFSET = 62;
  const num = Math.max(1, expressions.length);
  const LEFT_HANDLE_OFFSET = BASE_OFFSET + ((num - 1) * SPACING) / 2;

  const handleAddItem = useCallback(() => {
    createExpression.mutate({ nodeId: node.id, raw_string: '', graphId: node.graph_id });
  }, [createExpression, node.id, node.graph_id]);

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

  const handleMoveUp = useCallback(
    (index: number) => {
      const expr = expressions[index];
      if (expr) {
        moveExpressionUp.mutate({ expressionId: expr.id, graphId: node.graph_id });
      }
    },
    [expressions, moveExpressionUp, node.graph_id]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      const expr = expressions[index];
      if (expr) {
        moveExpressionDown.mutate({ expressionId: expr.id, graphId: node.graph_id });
      }
    },
    [expressions, moveExpressionDown, node.graph_id]
  );

  return (
    <>
      <Flex direction="column" gap="2" style={{ marginTop: 38, width: 'fit-content', minWidth: '100%' }}>
        {expressions.length > 0 && (
          <Flex direction="column" gap="2" style={{ width: '100%' }}>
            {expressions.map((expr, i) => {
              return (
                <BranchInput
                  key={expr.id}
                  expressionId={expr.id}
                  graphId={node.graph_id}
                  value={expr.raw_string}
                  onChange={(newValue) => handleUpdateItem(i, newValue)}
                  onDelete={() => handleDeleteItem(i)}
                  onMoveUp={() => handleMoveUp(i)}
                  onMoveDown={() => handleMoveDown(i)}
                  canMoveUp={i > 0}
                  canMoveDown={i < expressions.length - 1}
                />
              );
            })}
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
