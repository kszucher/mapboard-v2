import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { Flex, IconButton } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { useCallback, useMemo } from 'react';
import { useUpdateNode } from '../api/mutations';
import { EditableList } from './shared/EditableList.tsx';
import type { AppFlowNode } from './types.ts';
import { CodeMirrorEditor } from './CodeMirrorEditor';

interface FlowNodeLogicProps {
  data: AppFlowNode['data'];
}

interface LogicAssignmentRowProps {
  value: string;
  onChange: (newValue: string) => void;
  onDelete: () => void;
}

const LogicAssignmentRow = ({ value, onChange, onDelete }: LogicAssignmentRowProps) => {
  const isValid = useCallback((text: string) => {
    if (!text || !text.trim()) return false;
    return /^\s*state\.[a-zA-Z0-9_$]+\s*=/.test(text);
  }, []);

  const showValidation = useMemo(() => value.trim().length > 0, [value]);
  const valid = useMemo(() => isValid(value), [value, isValid]);

  return (
    <Flex gap="2" align="center" style={{ width: '100%' }}>
      <div className="nodrag" style={{ flexGrow: 1, display: 'flex' }}>
        <CodeMirrorEditor
          initialValue={value}
          onSave={onChange}
          singleLine={false} // Multiline support
          minHeight={32}
          minWidth={240}
        />
        <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center' }}>
          {showValidation && (valid ? <CheckIcon color="green" /> : <Cross2Icon color="red" />)}
        </div>
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

  const handleAssignmentsChange = useCallback(
    (newAssignments: string[]) => {
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
    },
    [node.id, node.graph_id, updateNodeMutation]
  );

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
