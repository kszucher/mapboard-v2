import { PlusIcon } from '@radix-ui/react-icons';
import { Flex, IconButton } from '@radix-ui/themes';

import { type SchemaField, SchemaFieldRow } from './SchemaFieldRow.tsx';

interface SchemaFieldsBodyProps {
  fields: SchemaField[];
  onFieldsChange: (newFields: SchemaField[]) => void;
}

export const SchemaFieldsBody = ({ fields, onFieldsChange }: SchemaFieldsBodyProps) => {
  const handleAddField = () => {
    const newFields = [...fields, { name: '', type: 'string' }];
    onFieldsChange(newFields);
  };

  const handleUpdateField = (index: number, newField: SchemaField) => {
    const newFields = [...fields];
    newFields[index] = newField;
    onFieldsChange(newFields);
  };

  const handleDeleteField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index);
    onFieldsChange(newFields);
  };

  return (
    <Flex direction="column" gap="2">
      {fields.length > 0 && (
        <Flex direction="column" gap="2">
          {fields.map((field, i) => (
            <SchemaFieldRow
              key={i}
              field={field}
              onChange={newField => handleUpdateField(i, newField)}
              onDelete={() => handleDeleteField(i)}
            />
          ))}
        </Flex>
      )}

      <Flex gap="2" align="center" style={{ marginLeft: 16, height: 32 }}>
        <IconButton onClick={handleAddField} size="1" variant="ghost" color="gray">
          <PlusIcon />
        </IconButton>
      </Flex>
    </Flex>
  );
};
