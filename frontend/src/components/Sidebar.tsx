import { Box, Button, Flex, Select, Text, TextField } from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { useGraphStore } from '../store/useGraphStore';

interface SidebarProps {
  isSidebarOpen: boolean;
  isGraphSelected: boolean;
}

export const Sidebar = ({ isSidebarOpen, isGraphSelected }: SidebarProps) => {
  const variables = useGraphStore(state => state.variables);
  const functions = useGraphStore(state => state.functions);

  return (
    <Box
      style={{
        width: isSidebarOpen ? '320px' : '0px',
        minWidth: isSidebarOpen ? '320px' : '0px',
        height: '100%',
        borderRight: isSidebarOpen ? '1px solid var(--gray-4)' : 'none',
        backgroundColor: 'var(--gray-2)',
        transition: 'width 0.2s ease-in-out, min-width 0.2s ease-in-out',
        overflowX: 'hidden',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Flex direction="column" gap="4" p="4" style={{ width: '320px' }}>
        <Text size="3" weight="bold">Sidebar</Text>

        {/* Variables Section */}
        <Flex direction="column" gap="2" style={{ borderBottom: '1px solid var(--gray-4)', paddingBottom: '16px' }}>
          <Text size="2" weight="bold">Variables</Text>

          {/* List Variables */}
          <Flex direction="column" gap="1" mb="2">
            {variables.map(v => (
              <Flex key={v.id} justify="between" align="center"
                    style={{ backgroundColor: 'var(--gray-3)', padding: '4px 8px', borderRadius: '4px' }}>
                <Text size="1" weight="medium">{v.name}</Text>
                <Text size="1" color="gray">{v.type}</Text>
              </Flex>
            ))}
            {variables.length === 0 && (
              <Text size="1" color="gray" style={{ fontStyle: 'italic' }}>No variables created yet.</Text>
            )}
          </Flex>

          {/* Add Variable Form */}
          <VariableForm isGraphSelected={isGraphSelected}/>
        </Flex>

        {/* Functions Section */}
        <Flex direction="column" gap="2" style={{ paddingBottom: '16px' }}>
          <Text size="2" weight="bold">Functions</Text>

          {/* List Functions */}
          <Flex direction="column" gap="1" mb="2">
            {functions.map(f => {
              const inputVar = f.input_variable ? (variables.find(v => v.id === f.input_variable)?.name ?? 'unknown') : 'None';
              const outputVar = f.output_variable ? (variables.find(v => v.id === f.output_variable)?.name ?? 'unknown') : 'None';
              return (
                <Flex key={f.id} justify="between" align="center"
                      style={{ backgroundColor: 'var(--gray-3)', padding: '4px 8px', borderRadius: '4px' }}>
                  <Text size="1" weight="medium">{f.name}</Text>
                  <Text size="1" color="gray">{inputVar} → {outputVar}</Text>
                </Flex>
              );
            })}
            {functions.length === 0 && (
              <Text size="1" color="gray" style={{ fontStyle: 'italic' }}>No functions created yet.</Text>
            )}
          </Flex>

          {/* Add Function Form */}
          <FunctionForm isGraphSelected={isGraphSelected}/>
        </Flex>
      </Flex>
    </Box>
  );
};

const VariableForm = ({ isGraphSelected }: { isGraphSelected: boolean }) => {
  const addVariable = useGraphStore(state => state.addVariable);
  const [name, setName] = useState('');
  const [type, setType] = useState<'boolean' | 'string' | 'number'>('string');

  const handleAdd = () => {
    if (!name.trim()) return;
    void addVariable(name.trim(), type);
    setName('');
  };

  return (
    <Flex direction="column" gap="2">
      <TextField.Root
        placeholder="Variable Name"
        value={name}
        onChange={e => setName(e.target.value)}
        disabled={!isGraphSelected}
      />
      <Select.Root
        value={type}
        onValueChange={(val) => setType(val as 'boolean' | 'string' | 'number')}
        disabled={!isGraphSelected}
      >
        <Select.Trigger style={{ width: '100%' }}/>
        <Select.Content>
          <Select.Item value="string">string</Select.Item>
          <Select.Item value="boolean">boolean</Select.Item>
          <Select.Item value="number">number</Select.Item>
        </Select.Content>
      </Select.Root>
      <Button size="1" onClick={handleAdd} disabled={!isGraphSelected || !name.trim()}>
        Add Variable
      </Button>
    </Flex>
  );
};

const FunctionForm = ({ isGraphSelected }: { isGraphSelected: boolean }) => {
  const variables = useGraphStore(state => state.variables);
  const addFunction = useGraphStore(state => state.addFunction);

  const [name, setName] = useState('');
  const [inputVar, setInputVar] = useState('none');
  const [outputVar, setOutputVar] = useState('none');
  const [rawString, setRawString] = useState('');

  // Reset selected variable if it is deleted
  useEffect(() => {
    if (variables.length > 0) {
      if (inputVar !== 'none' && !variables.some(v => v.id === inputVar)) {
        setInputVar('none');
      }
      if (outputVar !== 'none' && !variables.some(v => v.id === outputVar)) {
        setOutputVar('none');
      }
    } else {
      setInputVar('none');
      setOutputVar('none');
    }
  }, [variables, inputVar, outputVar]);

  const handleAdd = () => {
    if (!name.trim()) return;
    const finalInputVar = inputVar === 'none' || !inputVar ? null : inputVar;
    const finalOutputVar = outputVar === 'none' || !outputVar ? null : outputVar;
    void addFunction(name.trim(), finalInputVar, finalOutputVar, rawString);
    setName('');
    setRawString('');
  };

  return (
    <Flex direction="column" gap="2">
      <TextField.Root
        placeholder="Function Name"
        value={name}
        onChange={e => setName(e.target.value)}
        disabled={!isGraphSelected}
      />

      <Flex direction="column" gap="1">
        <Text size="1" color="gray">Input Variable</Text>
        <Select.Root
          value={inputVar}
          onValueChange={setInputVar}
          disabled={!isGraphSelected}
        >
          <Select.Trigger style={{ width: '100%' }}/>
          <Select.Content>
            <Select.Item value="none">None</Select.Item>
            {variables.map(v => (
              <Select.Item key={v.id} value={v.id}>{v.name}</Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Flex>

      <Flex direction="column" gap="1">
        <Text size="1" color="gray">Output Variable</Text>
        <Select.Root
          value={outputVar}
          onValueChange={setOutputVar}
          disabled={!isGraphSelected}
        >
          <Select.Trigger style={{ width: '100%' }}/>
          <Select.Content>
            <Select.Item value="none">None</Select.Item>
            {variables.map(v => (
              <Select.Item key={v.id} value={v.id}>{v.name}</Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Flex>

      <TextField.Root
        placeholder="raw_string"
        value={rawString}
        onChange={e => setRawString(e.target.value)}
        disabled={!isGraphSelected}
        style={{
          fontFamily: 'monospace',
          minHeight: '60px',
        }}
      />

      <Button size="1" onClick={handleAdd} disabled={!isGraphSelected || !name.trim()}>
        Add Function
      </Button>
    </Flex>
  );
};
