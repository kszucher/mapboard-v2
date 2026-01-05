import { Flex } from '@radix-ui/themes'
import { Handle, Position } from '@xyflow/react'
import { useCallback, useMemo } from 'react'
import { useUpdateExpression } from '../api/mutations'
import { useExpressions } from '../api/queries'
import { CodeMirrorEditor } from './CodeMirrorEditor'
import type { AppFlowNode } from './types.ts'

interface FlowNodeLogicProps {
  data: AppFlowNode['data'];
}

export const FlowNodeLogic = ({ data }: FlowNodeLogicProps) => {
  const updateExpressionMutation = useUpdateExpression();
  const { node } = data;
  const { data: allExpressions } = useExpressions(node.graph_id);

  const expression = useMemo(() =>
    allExpressions?.find(e => e.node_id === node.id),
    [allExpressions, node.id]
  );

  const raw = expression?.raw_string ?? '';

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
    [expression, node.graph_id, updateExpressionMutation]
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
        id={expression?.id}
        type="source"
        position={Position.Right}
      />
    </>
  );
};
