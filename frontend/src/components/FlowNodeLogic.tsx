import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { Flex, IconButton, TextField } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { useEffect, useRef, useState } from 'react';
import { useUpdateNode } from '../api/mutations';
import { EditableList } from './shared/EditableList.tsx';
import type { AppFlowNode } from './types.ts';

interface FlowNodeLogicProps {
  data: AppFlowNode['data'];
}

interface LogicAssignmentRowProps {
  value: string;
  onChange: (newValue: string) => void;
  onDelete: () => void;
}

const LogicAssignmentRow = ({ value, onChange, onDelete }: LogicAssignmentRowProps) => {
  const [localValue, setLocalValue] = useState(value);
  const lastSavedValueRef = useRef(value);

  // Sync local value when prop changes externally (not from our own save)
  useEffect(() => {
    // Only sync if the prop changed and it's different from what we last saved
    // This prevents syncing when the prop update came from our own onChange callback
    if (value !== lastSavedValueRef.current) {
      setLocalValue(value);
      lastSavedValueRef.current = value;
    }
  }, [value]);

  // Debounced auto-save while typing
  useEffect(() => {
    if (localValue === value) return;

    const timeout = setTimeout(() => {
      lastSavedValueRef.current = localValue;
      onChange(localValue);
    }, 300);

    return () => clearTimeout(timeout);
  }, [localValue, value, onChange]);

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
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
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

export const FlowNodeLogic = ({ data }: FlowNodeLogicProps) => {
  const updateNodeMutation = useUpdateNode();
  const { node } = data;

  const assignments = (node.node_type_logic_input as { logicalAssignments?: string[] } | undefined)?.logicalAssignments ?? [];

  const handleAssignmentsChange = (newAssignments: string[]) => {
    updateNodeMutation.mutate({
      nodeId: node.id,
      patch: {
        graph_id: node.graph_id,
        node_type_logic_input: {
          logicalAssignments: newAssignments,
        },
        // Don't update numHandles - it's independent for Logic nodes
      },
    });
  };

  return (
    <>
      <Flex direction="column" gap="3" style={{ marginTop: 38 }}>
        <EditableList<string>
          items={assignments}
          onItemsChange={handleAssignmentsChange}
          createNewItem={() => ''}
          renderItem={(assignment, index, { onUpdate, onDelete }) => (
            <LogicAssignmentRow
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
