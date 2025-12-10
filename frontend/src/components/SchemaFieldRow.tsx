import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { Flex, IconButton, Select, TextField } from '@radix-ui/themes';
import { useEffect, useState } from 'react';

export interface SchemaField {
  name: string;
  type: string;
}

interface SchemaFieldRowProps {
  field: SchemaField;
  onChange: (newField: SchemaField) => void;
  onDelete: () => void;
}

export const SchemaFieldRow = ({ field, onChange, onDelete }: SchemaFieldRowProps) => {
  const [localName, setLocalName] = useState(field.name);
  const [localType, setLocalType] = useState(field.type);

  useEffect(() => {
    setLocalName(field.name);
    setLocalType(field.type);
  }, [field]);

  const handleBlur = () => {
    if (localName !== field.name || localType !== field.type) {
      onChange({ name: localName, type: localType });
    }
  };

  const isValidName = (text: string) => {
    if (!text || !text.trim()) return false;
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(text.trim());
  };

  const showValidation = localName.trim().length > 0;
  const validName = isValidName(localName);

  return (
    <Flex gap="2" align="center" style={{ marginLeft: 16 }}>
      <div className="nodrag" style={{ width: 140 }}>
        <TextField.Root
          value={localName}
          onChange={e => setLocalName(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          placeholder="Name"
          style={{ width: '100%', boxShadow: 'none' }}
        >
          <TextField.Slot side="right">
            {showValidation && (validName ? <CheckIcon color="green" /> : <Cross2Icon color="red" />)}
          </TextField.Slot>
        </TextField.Root>
      </div>

      <Select.Root value={localType} onValueChange={value => {
        setLocalType(value);
        onChange({ name: localName, type: value });
      }}>
        <Select.Trigger style={{ width: 100 }} variant={"soft"} />
        <Select.Content>
          <Select.Item value="string">string</Select.Item>
          <Select.Item value="number">number</Select.Item>
          <Select.Item value="string array">string[]</Select.Item>
          <Select.Item value="number array">number[]</Select.Item>
        </Select.Content>
      </Select.Root>

      <IconButton onClick={onDelete} size="1" variant="ghost" color="gray">
        <Cross2Icon />
      </IconButton>
    </Flex>
  );
};
