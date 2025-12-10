import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { useGraphMutationsContext } from './contexts/GraphMutationsContext.tsx';
import type { SchemaField } from './SchemaFieldRow.tsx';
import { SchemaFieldsBody } from './SchemaFieldsBody.tsx';
import type { AppFlowNode } from './types.ts';

interface FlowNodeStartProps {
  data: AppFlowNode['data'];
}

export const FlowNodeStart = ({ data }: FlowNodeStartProps) => {
  const { updateNode } = useGraphMutationsContext();
  const { node } = data;

  // Reconstruct fields from the two separate arrays
  const schemaFields = node.nodeTypeStart?.schemaFields ?? [];
  const schemaTypes = node.nodeTypeStart?.schemaTypes ?? [];

  const fields: SchemaField[] = schemaFields.map((name, i) => ({
    name,
    type: schemaTypes[i] ?? 'string',
  }));

  const handleFieldsChange = (newFields: SchemaField[]) => {
    // Note: For Start nodes, we don't delete edges when fields are removed
    // because fields are independent from handles/edges

    // Split the fields back into two arrays
    const newSchemaFields = newFields.map(f => f.name);
    const newSchemaTypes = newFields.map(f => f.type);

    updateNode({
      nodeId: node._id,
      patch: {
        nodeTypeStart: {
          schemaFields: newSchemaFields,
          schemaTypes: newSchemaTypes,
        },
        // Don't update numHandles - it's independent for Start nodes
      },
    });
  };

  return (
    <>
      <Flex direction="column" gap="3" style={{ marginTop: 38 }}>
        <SchemaFieldsBody fields={fields} onFieldsChange={handleFieldsChange} />
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
