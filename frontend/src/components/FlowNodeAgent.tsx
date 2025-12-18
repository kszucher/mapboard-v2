import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { Flex, IconButton, TextArea, TextField } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { useCallback, useMemo } from 'react';
import { useUpdateNode } from '../api/mutations';
import { useDebouncedInput } from './hooks/useDebouncedInput.ts';
import { useResizableTextarea } from './hooks/useResizableTextarea.ts';
import { EditableList } from './shared/EditableList.tsx';
import type { AppFlowNode } from './types.ts';

interface FlowNodeAgentProps {
  data: AppFlowNode['data'];
}

interface AgentAssignmentRowProps {
  value: string;
  onChange: (newValue: string) => void;
  onDelete: () => void;
}

const AgentAssignmentRow = ({ value, onChange, onDelete }: AgentAssignmentRowProps) => {
  const { localValue, setLocalValue, handleBlur } = useDebouncedInput({ value, onChange });

  const isValid = useCallback((text: string) => {
    if (!text || !text.trim()) return false;
    return /^\s*state\.[a-zA-Z0-9_$]+\s*=/.test(text);
  }, []);

  const showValidation = useMemo(() => localValue.trim().length > 0, [localValue]);
  const valid = useMemo(() => isValid(localValue), [localValue, isValid]);

  return (
    <Flex gap="2" align="center">
      <div className="nodrag" style={{ width: 240 }}>
        <TextField.Root
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          onKeyDown={useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
              e.preventDefault();
            }
          }, [])}
          onBlur={handleBlur}
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
  const updateNodeMutation = useUpdateNode();
  const { node } = data;
  const agentInput = (node.node_type_agent_input as { agenticAssignments?: string[] } | undefined)?.agenticAssignments?.[0] ?? '';
  const savedHeight = (node.node_type_agent_input as { textareaHeight?: number } | undefined)?.textareaHeight ?? 60;
  const assignments = (node.node_type_agent_input as { assignments?: string[] } | undefined)?.assignments ?? [];

  const handleTextareaSave = useCallback(
    (value: string, height: number) => {
      updateNodeMutation.mutate({
        nodeId: node.id,
        patch: {
          graph_id: node.graph_id,
          node_type_agent_input: {
            ...(node.node_type_agent_input || {}),
            agenticAssignments: [value],
            textareaHeight: height,
          },
        },
      });
    },
    [node.id, node.graph_id, node.node_type_agent_input, updateNodeMutation]
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
    onSave: handleTextareaSave,
  });

  const handleAssignmentsChange = useCallback(
    (newAssignments: string[]) => {
      updateNodeMutation.mutate({
        nodeId: node.id,
        patch: {
          graph_id: node.graph_id,
          node_type_agent_input: {
            ...(node.node_type_agent_input || {}),
            assignments: newAssignments,
          },
        },
      });
    },
    [node.id, node.graph_id, node.node_type_agent_input, updateNodeMutation]
  );

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
