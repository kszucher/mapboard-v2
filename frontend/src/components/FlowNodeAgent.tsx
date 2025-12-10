import { Flex, TextArea } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import React, { useEffect, useRef, useState } from 'react';
import type { Id } from '../../../convex/convex/_generated/dataModel';
import type { AppFlowNode } from './types.ts';

interface FlowNodeAgentProps {
  data: AppFlowNode['data'];
  updateNode: (args: { nodeId: Id<'nodes'>; patch: any }) => void;
}

export const FlowNodeAgent = ({ data, updateNode }: FlowNodeAgentProps) => {
  const { node } = data;
  const agentInput = node.nodeTypeAgentInput?.agenticAssignments?.[0] ?? '';
  const savedHeight = node.nodeTypeAgentInput?.textareaHeight ?? 60;
  const [localValue, setLocalValue] = useState(agentInput);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialHeightRef = useRef(savedHeight);

  useEffect(() => {
    setLocalValue(agentInput);
  }, [agentInput]);

  const handleMouseDown = () => {
    // Track initial height when mouse down
    initialHeightRef.current = textareaRef.current?.offsetHeight ?? savedHeight;
  };

  const handleBlur = () => {
    if (localValue !== agentInput) {
      updateNode({
        nodeId: node._id,
        patch: {
          nodeTypeAgentInput: {
            ...node.nodeTypeAgentInput,
            agenticAssignments: [localValue],
            textareaHeight: textareaRef.current?.offsetHeight ?? savedHeight,
          },
        },
      });
    }
  };

  const handleMouseUp = () => {
    // Only save if height actually changed (user was resizing)
    const currentHeight = textareaRef.current?.offsetHeight;
    if (currentHeight && currentHeight !== initialHeightRef.current && currentHeight >= 60) {
      updateNode({
        nodeId: node._id,
        patch: {
          nodeTypeAgentInput: {
            ...node.nodeTypeAgentInput,
            agenticAssignments: node.nodeTypeAgentInput?.agenticAssignments ?? [localValue],
            textareaHeight: currentHeight,
          },
        },
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    }
    // Shift+Enter allows new line (default behavior)
  };

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
