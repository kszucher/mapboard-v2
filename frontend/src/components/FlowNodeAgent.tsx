import { Flex, IconButton, TextArea, TextField } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { useGraphMutationsContext } from './contexts/GraphMutationsContext.tsx';
import { useResizableTextarea } from './hooks/useResizableTextarea.ts';
import type { AppFlowNode } from './types.ts';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { useEffect, useState } from 'react';
import { EditableList } from './shared/EditableList.tsx';

interface FlowNodeAgentProps {
  data: AppFlowNode['data'];
}

interface AgentAssignmentRowProps {
  value: string;
  onChange: (newValue: string) => void;
  onDelete: () => void;
}

const AgentAssignmentRow = ({ value, onChange, onDelete }: AgentAssignmentRowProps) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = () => {
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  const isValid = (text: string) => {
    if (!text || !text.trim()) return false;
    return /^\s*state\.[a-zA-Z0-9_$]+\s*=/.test(text);
  };

  const showValidation = localValue.trim().length > 0;
  const valid = isValid(localValue);

  return (
    <Flex gap="2" align="center" style={{ marginLeft: 16 }}>
      <div className="nodrag" style={{ width: 240 }}>
        <TextField.Root
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          placeholder="Assignment"
          style={{ width: '100%', boxShadow: 'none' }}
        >
          <TextField.Slot side="right">
            {showValidation && (valid ? <CheckIcon color="green" /> : <Cross2Icon color="red" />)}
          </TextField.Slot>
        </TextField.Root>
      </div>

      <IconButton onClick={onDelete} size="1" variant="ghost" color="gray">
        <Cross2Icon />
      </IconButton>
    </Flex>
  );
};

export const FlowNodeAgent = ({ data }: FlowNodeAgentProps) => {
  const { updateNode } = useGraphMutationsContext();
  const { node } = data;
  const agentInput = node.nodeTypeAgentInput?.agenticAssignments?.[0] ?? '';
  const savedHeight = node.nodeTypeAgentInput?.textareaHeight ?? 60;
  const assignments = node.nodeTypeAgentInput?.assignments ?? [];

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

  const handleAssignmentsChange = (newAssignments: string[]) => {
    updateNode({
      nodeId: node._id,
      patch: {
        nodeTypeAgentInput: {
          ...node.nodeTypeAgentInput,
          assignments: newAssignments,
        },
      },
    });
  };

  return (
    <>
      <Flex direction="column" gap="3" style={{ marginTop: 38 }}>
        <div className="nodrag" onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} style={{ marginLeft: 16 }}>
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

        <EditableList<string>
          items={assignments}
          onItemsChange={handleAssignmentsChange}
          createNewItem={() => ''}
          renderItem={(assignment, index, { onUpdate, onDelete }) => (
            <AgentAssignmentRow
              key={index}
              value={assignment}
              onChange={onUpdate}
              onDelete={onDelete}
            />
          )}
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
