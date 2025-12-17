import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { Flex, Select, TextField } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { useGraphMutationsContext } from './contexts/GraphMutationsContext.tsx';
import { EditableList, type ItemHandlers } from './shared/EditableList.tsx';
import type { AppFlowNode } from './types.ts';

interface SchemaField {
  name: string;
  type: string;
}

interface FlowNodeStartProps {
  data: AppFlowNode['data'];
}

export const FlowNodeStart = ({ data }: FlowNodeStartProps) => {
  const { updateNode } = useGraphMutationsContext();
  const { node } = data;

  const schemaFields = (node.node_type_start as { schemaFields?: string[] } | undefined)?.schemaFields ?? [];
  const schemaTypes = (node.node_type_start as { schemaTypes?: string[] } | undefined)?.schemaTypes ?? [];

  const fields: SchemaField[] = schemaFields.map((name, i) => ({
    name,
    type: schemaTypes[i] ?? 'string',
  }));

  const handleFieldsChange = (newFields: SchemaField[]) => {
    updateNode({
      nodeId: node.id,
      patch: {
        graph_id: node.graph_id,
        node_type_start: {
          schemaFields: newFields.map(f => f.name),
          schemaTypes: newFields.map(f => f.type),
        },
      },
    });
  };

  return (
    <>
      <Flex direction="column" gap="3" style={{ marginTop: 38 }}>
        <EditableList
          items={fields}
          onItemsChange={handleFieldsChange}
          createNewItem={() => ({ name: '', type: 'string' })}
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
  const isValidName = (text: string) => {
    if (!text || !text.trim()) return false;
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(text.trim());
  };

  const showValidation = field.name.trim().length > 0;
  const validName = isValidName(field.name);

  return (
    <Flex gap="2" align="center" style={{ marginLeft: 16 }}>
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

      <Select.Root value={field.type} onValueChange={value => handlers.onUpdate({ ...field, type: value })}>
        <Select.Trigger style={{ width: 100 }} variant={'soft'} />
        <Select.Content>
          <Select.Item value="string">string</Select.Item>
          <Select.Item value="number">number</Select.Item>
          <Select.Item value="string array">string[]</Select.Item>
          <Select.Item value="number array">number[]</Select.Item>
        </Select.Content>
      </Select.Root>

      <Cross2Icon onClick={handlers.onDelete} style={{ cursor: 'pointer' }} />
    </Flex>
  );
};
