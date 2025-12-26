import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { useCallback } from 'react';
import { useUpdateNodeExpressions } from '../api/mutations';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import type { AppFlowNode } from './types.ts';

interface FlowNodeAgentProps {
  data: AppFlowNode['data'];
}

export const FlowNodeAgent = ({ data }: FlowNodeAgentProps) => {
  const updateExpressionsMutation = useUpdateNodeExpressions();
  const { node } = data;
  const agentInput = node.expressions?.[0]?.raw_string ?? '';

  const handleEditorSave = useCallback(
    (value: string) => {
      updateExpressionsMutation.mutate({
        nodeId: node.id,
        graphId: node.graph_id,
        expressions: [
          {
            idx: 0,
            raw_string: value,
          },
        ],
      });
    },
    [node.id, node.graph_id, updateExpressionsMutation],
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
