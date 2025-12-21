import { Flex, TextArea } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { useCallback } from 'react';
import { useUpdateNode } from '../api/mutations';
import { useResizableTextarea } from './hooks/useResizableTextarea.ts';
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
  const handleTextareaSave = useCallback(
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

  const {
    textareaRef,
    localValue,
    setLocalValue,
    handleBlur,
    handleKeyDown,
    width,
    height,
  } = useResizableTextarea({
    initialValue: agentInput,
    onSave: handleTextareaSave,
    minWidth: 240,
    maxWidth: 600,
  });

  return (
    <>
      <Flex direction="column" gap="3" style={{ marginTop: 34 }}>
        <div className="nodrag">
          <TextArea
            ref={textareaRef}
            value={localValue}
            onChange={e => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Agent instructions"
            style={{
              width: width,
              height: height,
              boxShadow: 'none',
              resize: 'none',
              overflow: 'hidden',
              minHeight: 60,
              transition: 'width 0.1s, height 0.1s', // Smooth transition
            }}
          />
        </div>

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
