import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { useCallback } from 'react';
import { useUpdateNode } from '../api/mutations';
import type { AppFlowNode } from './types.ts';
import { CodeMirrorEditor } from './CodeMirrorEditor';

interface FlowNodeLogicProps {
  data: AppFlowNode['data'];
}

export const FlowNodeLogic = ({ data }: FlowNodeLogicProps) => {
  const updateNodeMutation = useUpdateNode();
  const { node } = data;

  const raw = node.expressions?.[0]?.raw_string ?? '';

  const handleEditorSave = useCallback(
    (value: string) => {
      updateNodeMutation.mutate({
        nodeId: node.id,
        patch: {
          graph_id: node.graph_id,
          expressions: [
            {
              idx: 0,
              raw_string: value,
            },
          ],
        },
      });
    },
    [node.id, node.graph_id, updateNodeMutation]
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
