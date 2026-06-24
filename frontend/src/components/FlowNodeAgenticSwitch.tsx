import { PlusIcon } from '@radix-ui/react-icons';
import { Flex, IconButton } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { useCallback, useMemo } from 'react';
import {
  useCreateExpression,
  useDeleteExpression,
  useMoveExpressionDown,
  useMoveExpressionUp,
  useUpdateExpression,
} from '../api/mutations';
import { useExpressions } from '../api/queries';
import { BranchInput } from './BranchInput.tsx';
import { PlainEditor } from './PlainEditor';
import type { AppFlowNode } from './types.ts';

interface FlowNodeAgenticSwitchProps {
  data: AppFlowNode['data'];
}

export const FlowNodeAgenticSwitch = ({ data }: FlowNodeAgenticSwitchProps) => {
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

  const baseExpression = useMemo(() => {
    return expressions.find(e => e.type === 'BASE');
  }, [expressions]);

  const subExpressions = useMemo(() => {
    return expressions.filter(e => e.type === 'SUB');
  }, [expressions]);

  const SPACING = 32;
  const BASE_OFFSET = 62;
  const LEFT_HANDLE_OFFSET = BASE_OFFSET;

  const handleAddItem = useCallback(() => {
    createExpression.mutate({ nodeId: node.id, raw_string: '', graphId: node.graph_id, type: 'SUB' });
  }, [createExpression, node.id, node.graph_id]);

  const handleUpdateBase = useCallback(
    (newValue: string) => {
      if (baseExpression) {
        updateExpression.mutate({
          expressionId: baseExpression.id,
          patch: { raw_string: newValue },
          graphId: node.graph_id,
        });
      }
    },
    [baseExpression, updateExpression, node.graph_id]
  );

  const handleUpdateItem = useCallback(
    (index: number, newValue: string) => {
      const expr = subExpressions[index];
      if (expr) {
        updateExpression.mutate({
          expressionId: expr.id,
          patch: { raw_string: newValue },
          graphId: node.graph_id,
        });
      }
    },
    [subExpressions, updateExpression, node.graph_id]
  );

  const handleDeleteItem = useCallback(
    (index: number) => {
      const expr = subExpressions[index];
      if (expr) {
        deleteExpression.mutate({ expressionId: expr.id, graphId: node.graph_id });
      }
    },
    [subExpressions, deleteExpression, node.graph_id]
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      const expr = subExpressions[index];
      if (expr) {
        moveExpressionUp.mutate({ expressionId: expr.id, graphId: node.graph_id });
      }
    },
    [subExpressions, moveExpressionUp, node.graph_id]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      const expr = subExpressions[index];
      if (expr) {
        moveExpressionDown.mutate({ expressionId: expr.id, graphId: node.graph_id });
      }
    },
    [subExpressions, moveExpressionDown, node.graph_id]
  );

  return (
    <>
      <Flex direction="column" gap="2" style={{ marginTop: 38, width: 'fit-content', minWidth: '100%' }}>
        {baseExpression && (
          <Flex gap="2" align="center" style={{ width: '100%', height: 24 }}>
            <div className="nodrag nopan" style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
              <PlainEditor
                initialValue={baseExpression.raw_string}
                onSave={handleUpdateBase}
                singleLine={true}
                minWidth={100}
              />
            </div>
            <div style={{ fontSize: '10px', color: '#ffc53d', fontWeight: 'bold', paddingRight: '8px', minWidth: '40px', textAlign: 'right' }}>
              SWITCH
            </div>
          </Flex>
        )}

        {subExpressions.length > 0 && (
          <Flex direction="column" gap="2" style={{ width: '100%' }}>
            {subExpressions.map((expr, i) => {
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
                  canMoveDown={i < subExpressions.length - 1}
                />
              );
            })}
          </Flex>
        )}

        <Flex gap="2" align="center" style={{ height: 32 }}>
          <IconButton onClick={handleAddItem} size="1" variant="ghost" color="gray">
            <PlusIcon/>
          </IconButton>
        </Flex>
      </Flex>

      <Handle type="target" position={Position.Left} style={{ top: LEFT_HANDLE_OFFSET }}/>

      {subExpressions.map((expr, i) => (
        <Handle
          key={expr.id}
          id={expr.id}
          type="source"
          position={Position.Right}
          style={{
            top: BASE_OFFSET + (i + 1) * SPACING,
          }}
        />
      ))}
    </>
  );
};
