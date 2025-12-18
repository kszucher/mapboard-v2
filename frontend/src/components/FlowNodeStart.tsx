import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { Flex, Select, TextField } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { useCallback, useMemo } from 'react';
import { useUpdateNode } from '../api/mutations';
import { EditableList, type ItemHandlers } from './shared/EditableList.tsx';
import type { AppFlowNode } from './types.ts';

interface SchemaField {
  name: string;
  type: string;
}

interface FlowNodeStartProps {
  data: AppFlowNode['data'];
}

const SCHEMA_TYPES = ['string', 'number', 'string array', 'number array'] as const;
const DEFAULT_SCHEMA_TYPE = 'string' as const;

export const FlowNodeStart = ({ data }: FlowNodeStartProps) => {
  const updateNodeMutation = useUpdateNode();
  const { node } = data;

  const nodeTypeStart = node.node_type_start as { schemaFields?: string[]; schemaTypes?: string[] } | undefined;

  const fields = useMemo<SchemaField[]>(() => {
    const schemaFields = nodeTypeStart?.schemaFields ?? [];
    const schemaTypes = nodeTypeStart?.schemaTypes ?? [];
    return schemaFields.map((name, i) => ({
      name,
      type: schemaTypes[i] ?? DEFAULT_SCHEMA_TYPE,
    }));
  }, [nodeTypeStart]);

  const handleFieldsChange = useCallback(
    (newFields: SchemaField[]) => {
      updateNodeMutation.mutate({
        nodeId: node.id,
        patch: {
          graph_id: node.graph_id,
          node_type_start: {
            schemaFields: newFields.map(f => f.name),
            schemaTypes: newFields.map(f => f.type),
          },
        },
      });
    },
    [node.id, node.graph_id, updateNodeMutation]
  );

  return (
    <>
      <Flex direction="column" gap="3" style={{ marginTop: 38 }}>
        <EditableList
          items={fields}
          onItemsChange={handleFieldsChange}
          createNewItem={useCallback(() => ({ name: '', type: DEFAULT_SCHEMA_TYPE }), [])}
          renderItem={(field, _, handlers) => (
            <SchemaFieldRow key={_} field={field} handlers={handlers} />
          )}
        />
      </Flex>

      <Handle type="target" position={Position.Left} />
      <Handle id="0" type="source" position={Position.Right} />
    </>
  );
};

interface SchemaFieldRowProps {
  field: SchemaField;
  handlers: ItemHandlers<SchemaField>;
}

const SchemaFieldRow = ({ field, handlers }: SchemaFieldRowProps) => {
  const isValidName = useCallback((text: string) => {
    if (!text || !text.trim()) return false;
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(text.trim());
  }, []);

  const showValidation = useMemo(() => field.name.trim().length > 0, [field.name]);
  const validName = useMemo(() => isValidName(field.name), [field.name, isValidName]);

  return (
    <Flex gap="2" align="center">
      <div className="nodrag" style={{ width: 140 }}>
        <TextField.Root
          value={field.name}
          onChange={e => handlers.onUpdate({ ...field, name: e.target.value })}
          placeholder="Name"
          style={{ width: '100%', boxShadow: 'none' }}
        >
          <TextField.Slot side="right">
            {showValidation && (validName ? <CheckIcon color="green" /> : <Cross2Icon color="red" />)}
          </TextField.Slot>
        </TextField.Root>
      </div>

        <Select.Root
          value={field.type}
          onValueChange={useCallback((value: string) => handlers.onUpdate({ ...field, type: value }), [field, handlers])}
        >
          <Select.Trigger style={{ width: 100 }} variant={'soft'} />
          <Select.Content>
            {SCHEMA_TYPES.map(type => (
              <Select.Item key={type} value={type}>
                {type === 'string array' ? 'string[]' : type === 'number array' ? 'number[]' : type}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>

      <Cross2Icon onClick={handlers.onDelete} style={{ cursor: 'pointer' }} />
    </Flex>
  );
};
