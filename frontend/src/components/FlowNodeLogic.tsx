import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { Flex, IconButton, TextField } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { useEffect, useState } from 'react';
import { useGraphMutationsContext } from './contexts/GraphMutationsContext.tsx';
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

export const FlowNodeLogic = ({ data }: FlowNodeLogicProps) => {
  const { updateNode } = useGraphMutationsContext();
  const { node } = data;

  const assignments = (node.node_type_logic_input as { logicalAssignments?: string[] } | undefined)?.logicalAssignments ?? [];

  const handleAssignmentsChange = (newAssignments: string[]) => {
    updateNode({
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
