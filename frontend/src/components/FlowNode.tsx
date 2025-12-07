import { CheckIcon, Cross2Icon, DotsHorizontalIcon, PlusIcon } from '@radix-ui/react-icons';
import { Badge, Box, DropdownMenu, Flex, IconButton, TextField } from '@radix-ui/themes';
import { Handle, type NodeProps, Position, useUpdateNodeInternals } from '@xyflow/react';
import { useMutation } from 'convex/react';
import { memo, useEffect, useRef } from 'react';
import { api } from '../../../convex/convex/_generated/api';
import type { AppFlowNode } from './types.ts';

import { useState } from 'react';
import type { Id } from '../../../convex/convex/_generated/dataModel';

interface BranchInputProps {
  value: string;
  onChange: (newValue: string) => void;
  onDelete: () => void;
  enableValidation?: boolean;
}

const BranchInput = ({ value, onChange, onDelete, enableValidation }: BranchInputProps) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const isValid = (text: string) => {
    if (!text || !text.trim()) return false;
    return /^\s*state\.[a-zA-Z0-9_$]+\s*=/.test(text);
  };

  const showValidation = enableValidation && localValue.trim().length > 0;
  const valid = isValid(localValue);

  return (
    <Flex gap="2" align="center" style={{ marginLeft: 16 }}>
      <TextField.Root
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => {
          if (localValue !== value) {
            onChange(localValue);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur(); // Trigger blur to save
          }
        }}
        style={{ flexGrow: 1, boxShadow: 'none' }}
      >
        <TextField.Slot side="right">
          {showValidation && (
            valid ? <CheckIcon color="green" /> : <Cross2Icon color="red" />
          )}
        </TextField.Slot>
      </TextField.Root>
      <IconButton onClick={onDelete} size="1" variant="ghost" color="gray">
        <Cross2Icon />
      </IconButton>
    </Flex>
  );
};

interface SwitchNodeContentProps {
  nodeId: Id<'nodes'>;
  inputValue: any;
  inputTextPrimary?: string;
  inputTextsSecondary?: string[];
  updateNode: (args: { nodeId: Id<'nodes'>; patch: any }) => void;
  isLogicalSwitch?: boolean;
}

const SwitchNodeContent = ({ nodeId, inputValue, inputTextsSecondary, updateNode, isLogicalSwitch }: SwitchNodeContentProps) => {
  const branches = inputTextsSecondary ?? (Array.isArray(inputValue?.branches) ? inputValue.branches : []);

  const handleAddBranch = () => {
    const newBranches = [...branches, ""];

    updateNode({
      nodeId,
      patch: {
        inputTextsSecondary: newBranches,
        numHandles: newBranches.length,
      }
    });
  };

  const handleUpdateBranch = (index: number, newValue: string) => {
    const newBranches = [...branches];
    newBranches[index] = newValue;
    updateNode({
      nodeId,
      patch: {
        inputTextsSecondary: newBranches,
      }
    });
  };

  const handleDeleteBranch = (index: number) => {
    const newBranches = branches.filter((_: string, i: number) => i !== index);
    updateNode({
      nodeId,
      patch: {
        inputTextsSecondary: newBranches,
        numHandles: newBranches.length
      }
    });
  };

  return (
    <Flex direction="column" gap="2">
      {branches.length > 0 && (
        <Flex direction="column" gap="2">
          {branches.map((branch: string, i: number) => (
            <BranchInput
              key={i}
              value={branch}
              onChange={(val) => handleUpdateBranch(i, val)}
              onDelete={() => handleDeleteBranch(i)}
              enableValidation={isLogicalSwitch}
            />
          ))}
        </Flex>
      )}

      <Flex gap="2" align="center" style={{ marginLeft: 16, height: 32 }}>
        <IconButton onClick={handleAddBranch} size="1" variant="ghost" color="gray">
          <PlusIcon />
        </IconButton>
      </Flex>
    </Flex>
  );
};

const CustomNodeComponent = ({ data, id }: NodeProps<AppFlowNode>) => {
  const deleteNode = useMutation(api.nodes.deleteNode);
  const updateNode = useMutation(api.nodes.updateNode);
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(id);
  }, [data.node.numHandles, data.node.nodeType, id, updateNodeInternals]);


  if (!data) return null;

  const renderCount = useRef(0);
  renderCount.current++;

  console.log('ACTUAL RENDER:', renderCount.current, data.node._id);

  const isSwitch = data.node.nodeType === 'LOGICAL_SWITCH' || data.node.nodeType === 'AGENTIC_SWITCH';

  let SPACING = 24;
  let BASE_OFFSET = 50;
  let LEFT_HANDLE_OFFSET: number | undefined = undefined;

  if (isSwitch) {
    SPACING = 40;
    BASE_OFFSET = 66;

    const num = Math.max(1, data.node.numHandles || 0); // avoid negative or 0 issues
    LEFT_HANDLE_OFFSET = BASE_OFFSET + ((num - 1) * SPACING) / 2;
  }

  return (
    <div
      style={{
        background: '#222222',
        borderRadius: 16,
        padding: 12,
        minWidth: 200,
        minHeight: 80,
      }}
    >
      <Box position="absolute" top="8px" left="8px">
        <Flex direction="row" gap="4px" align="center">
          <Badge color={'gray'} size="2">
            {'N' + data.node.iid}
          </Badge>
          <Badge color={data.node.color} size="2">
            {data.node.label}
          </Badge>
        </Flex>
      </Box>

      <Box position="absolute" top="8px" right="8px">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <IconButton variant="soft" size="1" color="gray" style={{ pointerEvents: 'auto', background: 'none' }}>
              <DotsHorizontalIcon />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content onCloseAutoFocus={e => e.preventDefault()}>
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger>{'Connect To...'}</DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent>
                <DropdownMenu.Item key={1}></DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
            <DropdownMenu.Item onClick={() => deleteNode({ nodeId: data.node._id })}>
              {'Delete'}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </Box>

      {data.node.nodeType === 'LOGICAL_SWITCH' || data.node.nodeType === 'AGENTIC_SWITCH' ? (
        <Flex direction="column" gap="3" style={{ marginTop: 38 }}>
          <SwitchNodeContent
            nodeId={data.node._id}
            inputValue={data.node.inputValue}

            inputTextsSecondary={data.node.inputTextsSecondary}
            updateNode={updateNode}
            isLogicalSwitch={data.node.nodeType === 'LOGICAL_SWITCH'}
          />
        </Flex>
      ) : (
        <div style={{ marginTop: 40 }}>{'Instructions'}</div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        style={LEFT_HANDLE_OFFSET ? { top: LEFT_HANDLE_OFFSET } : {}}
      />

      {Array.from({ length: data.node.numHandles }).map((_, i) => (
        <Handle
          key={i}
          id={String(i)}
          type="source"
          position={Position.Right}
          style={{
            top: BASE_OFFSET + i * SPACING,
          }}
        />
      ))}
    </div>
  );
};

export const CustomNode = memo(CustomNodeComponent, (prev, next) => {
  return prev.data === next.data;
});
