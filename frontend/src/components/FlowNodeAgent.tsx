import { Flex } from '@radix-ui/themes'
import { Handle, Position } from '@xyflow/react'
import { useCallback, useMemo } from 'react'
import { useUpdateExpression } from '../api/mutations'
import { useExpressions } from '../api/queries'
import { PlainEditor } from './PlainEditor'
import { ExpressionActionsDropdown } from './ExpressionActionsDropdown'
import type { AppFlowNode } from './types.ts'

interface FlowNodeAgentProps {
  data: AppFlowNode['data'];
}

export const FlowNodeAgent = ({ data }: FlowNodeAgentProps) => {
  const updateExpressionMutation = useUpdateExpression();

  const { node } = data;
  const { data: allExpressions } = useExpressions(node.graph_id);

  const expression = useMemo(() =>
    allExpressions?.find(e => e.node_id === node.id),
    [allExpressions, node.id]
  );

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
      <Flex gap="2" align="center" style={{ marginTop: 34, width: '100%' }}>
        <div className="nodrag" style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
          <PlainEditor
            initialValue={agentInput}
            onSave={handleEditorSave}
            minWidth={240}
            maxWidth={600}
          />
        </div>

        {expression && (
          <ExpressionActionsDropdown
            expressionId={expression.id}
            graphId={node.graph_id}
          />
        )}
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
