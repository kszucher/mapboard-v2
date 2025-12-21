import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { useCallback } from 'react';
import { useUpdateNode } from '../api/mutations';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import type { AppFlowNode } from './types.ts';

interface FlowNodeAgentProps {
  data: AppFlowNode['data'];
}

export const FlowNodeAgent = ({ data }: FlowNodeAgentProps) => {
  const updateNodeMutation = useUpdateNode();
  const { node } = data;
  const agentInput = (node.node_type_agent_input as {
    agenticAssignments?: string[]
  } | undefined)?.agenticAssignments?.[0] ?? '';

  const handleEditorSave = useCallback(
    (value: string) => {
      updateNodeMutation.mutate({
        nodeId: node.id,
        patch: {
          graph_id: node.graph_id,
          node_type_agent_input: {
            ...(node.node_type_agent_input || {}),
            agenticAssignments: [value],
          },
        },
      });
    },
    [node.id, node.graph_id, node.node_type_agent_input, updateNodeMutation],
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
