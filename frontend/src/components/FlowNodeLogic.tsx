import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { useCallback } from 'react';
import { useUpdateNodeExpressions } from '../api/mutations';
import type { AppFlowNode } from './types.ts';
import { CodeMirrorEditor } from './CodeMirrorEditor';

interface FlowNodeLogicProps {
  data: AppFlowNode['data'];
}

export const FlowNodeLogic = ({ data }: FlowNodeLogicProps) => {
  const updateExpressionsMutation = useUpdateNodeExpressions();
  const { node } = data;

  const raw = node.expressions?.[0]?.raw_string ?? '';

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
    [node.id, node.graph_id, updateExpressionsMutation]
  );

  return (
    <>
      <Flex direction="column" gap="3" style={{ marginTop: 38 }}>
        <CodeMirrorEditor
          initialValue={raw}
          onSave={handleEditorSave}
          singleLine={false}
          minHeight={64}
          minWidth={240}
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
