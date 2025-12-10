import { Flex, TextArea } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { useGraphMutationsContext } from './contexts/GraphMutationsContext.tsx';
import { useResizableTextarea } from './hooks/useResizableTextarea.ts';
import type { AppFlowNode } from './types.ts';

interface FlowNodeAgentProps {
  data: AppFlowNode['data'];
}

export const FlowNodeAgent = ({ data }: FlowNodeAgentProps) => {
  const { updateNode } = useGraphMutationsContext();
  const { node } = data;
  const agentInput = node.nodeTypeAgentInput?.agenticAssignments?.[0] ?? '';
  const savedHeight = node.nodeTypeAgentInput?.textareaHeight ?? 60;

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
    onSave: (value, height) => {
      updateNode({
        nodeId: node._id,
        patch: {
          nodeTypeAgentInput: {
            ...node.nodeTypeAgentInput,
            agenticAssignments: [value],
            textareaHeight: height,
          },
        },
      });
    },
  });

  return (
    <>
      <Flex direction="column" gap="3" style={{ marginTop: 38 }}>
        <div className="nodrag" onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}>
          <TextArea
            ref={textareaRef}
            value={localValue}
            onChange={e => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Agent instructions"
            style={{
              width: 240,
              height: savedHeight,
              boxShadow: 'none',
              resize: 'vertical'
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

