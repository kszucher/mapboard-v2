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
  const savedHeight = (node.node_type_agent_input as { textareaHeight?: number } | undefined)?.textareaHeight ?? 60;
  const savedWidth = (node.node_type_agent_input as { textareaWidth?: number } | undefined)?.textareaWidth ?? 240;

  const handleTextareaSave = useCallback(
    (value: string, height: number, width: number) => {
      updateNodeMutation.mutate({
        nodeId: node.id,
        patch: {
          graph_id: node.graph_id,
          node_type_agent_input: {
            ...(node.node_type_agent_input || {}),
            agenticAssignments: [value],
            textareaHeight: height,
            textareaWidth: width,
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
    handleMouseDown,
    handleMouseUp,
    handleBlur,
    handleKeyDown,
  } = useResizableTextarea({
    initialValue: agentInput,
    savedHeight,
    savedWidth,
    onSave: handleTextareaSave,
  });

  return (
    <>
      <Flex direction="column" gap="3" style={{ marginTop: 34 }}>
        <div className="nodrag" onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}>
          <TextArea
            ref={textareaRef}
            value={localValue}
            onChange={e => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Agent instructions"
            style={{
              width: savedWidth,
              height: savedHeight,
              boxShadow: 'none',
              resize: 'both',
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
