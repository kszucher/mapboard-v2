import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { useCallback } from 'react';
import { useUpdateExpression } from '../api/mutations';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import type { AppFlowNode } from './types.ts';

interface FlowNodeAgentProps {
  data: AppFlowNode['data'];
}

export const FlowNodeAgent = ({ data }: FlowNodeAgentProps) => {
  const updateExpressionMutation = useUpdateExpression();
  const { node } = data;
  const expression = node.expressions?.[0];
  const agentInput = expression?.raw_string ?? '';

  const handleEditorSave = useCallback(
    (value: string) => {
      if (!expression) return;

      updateExpressionMutation.mutate({
        expressionId: expression.id,
        graphId: node.graph_id,
        patch: {
          raw_string: value,
        },
      });
    },
    [expression, node.graph_id, updateExpressionMutation],
  );

  return (
    <>
      <Flex direction="column" gap="3" style={{ marginTop: 34 }}>
        <CodeMirrorEditor
          initialValue={agentInput}
          onSave={handleEditorSave}
          minWidth={240}
          maxWidth={600}
        />
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
